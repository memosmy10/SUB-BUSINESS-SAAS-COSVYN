/**
 * Route Optimizer Service for ScaleKitchen
 * 
 * Features:
 * - 100% Free / Zero API Cost (Runs entirely client-side in browser)
 * - Haversine distance calculation between Hub and all customer coordinates
 * - Extracts latitude & longitude from Google Maps URLs, short links, or raw coordinates
 * - Solves the Traveling Salesperson Problem (TSP) using Nearest Neighbor + 2-Opt local search
 * - Generates Multi-Stop Google Maps directions links (Round-trip from Hub -> Customers -> Hub)
 * - Formats WhatsApp dispatch route messages for delivery staff
 */

import { getPlanDeliveryDayNumber } from './store';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface HubLocation {
  name: string;
  address?: string;
  locationLink?: string;
  lat?: number;
  lng?: number;
}

export interface RouteStop {
  id: string;
  name: string;
  mobile: string;
  address: string;
  area?: string;
  locationLink?: string;
  lat?: number;
  lng?: number;
  hasExactCoordinates?: boolean;
  activePlans?: any[];
  notes?: string;
  highlightMark?: string;
  [key: string]: any;
}

export interface OptimizedStop extends RouteStop {
  sequence: number;
  distanceFromPrevKm: number;
  estMinutesFromPrev: number;
  cumulativeDistanceKm: number;
  directNavUrl: string;
}

export interface OptimizedRouteResult {
  hub: HubLocation;
  orderedStops: OptimizedStop[];
  totalDistanceKm: number;
  totalEstMinutes: number;
  masterGoogleMapsUrl: string;
  googleMapsLegsUrls: string[];
}

/**
 * Extracts latitude and longitude from Google Maps links or raw coordinate strings.
 * Examples handled:
 * - "19.0760, 72.8777" or "19.0760,72.8777"
 * - https://maps.google.com/?q=19.0760,72.8777
 * - https://www.google.com/maps/@19.0760,72.8777,15z
 * - https://www.google.com/maps/place/19.0760,72.8777
 * - https://www.google.com/maps/place/.../@19.0760,72.8777,17z/...
 * - https://maps.apple.com/?ll=19.0760,72.8777
 */
export const extractCoordinates = (linkOrCoords?: string): LatLng | null => {
  if (!linkOrCoords || typeof linkOrCoords !== 'string') return null;
  const str = linkOrCoords.trim();

  // 1. Raw Coordinates: "19.0760, 72.8777" or "19.0760,72.8777"
  const rawCoordsMatch = str.match(/^(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (rawCoordsMatch) {
    const lat = parseFloat(rawCoordsMatch[1]);
    const lng = parseFloat(rawCoordsMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  // 2. URL @lat,lng format (@19.0760,72.8777)
  const atMatch = str.match(/@(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  // 3. Query parameter q=lat,lng or ll=lat,lng or query=lat,lng or destination=lat,lng
  const queryMatch = str.match(/[?&](?:q|ll|query|destination)=(-?\d{1,3}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)/i);
  if (queryMatch) {
    const lat = parseFloat(queryMatch[1]);
    const lng = parseFloat(queryMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  // 4. Place URL format /place/lat,lng
  const placeMatch = str.match(/\/place\/(-?\d{1,3}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)/i);
  if (placeMatch) {
    const lat = parseFloat(placeMatch[1]);
    const lng = parseFloat(placeMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  return null;
};

const isValidLatLng = (lat: number, lng: number): boolean => {
  return !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
};

/**
 * Calculates Great-Circle distance between two coordinates in kilometers using Haversine formula.
 */
export const calculateHaversineKm = (coord1: LatLng, coord2: LatLng): number => {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(coord2.lat - coord1.lat);
  const dLng = toRad(coord2.lng - coord1.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(coord1.lat)) * Math.cos(toRad(coord2.lat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const toRad = (deg: number): number => (deg * Math.PI) / 180;

/**
 * Deterministic pseudo-coordinate offset for areas/addresses that don't have GPS coordinates yet,
 * to ensure they are grouped together geographically rather than placed randomly.
 */
export const getAreaClusterOffset = (hubCoord: LatLng, areaName: string): LatLng => {
  if (!areaName) return hubCoord;
  let hash = 0;
  for (let i = 0; i < areaName.length; i++) {
    hash = (hash << 5) - hash + areaName.charCodeAt(i);
    hash |= 0;
  }
  // Offset by up to ~2-3 km in a clustered direction based on area string
  const angle = (Math.abs(hash) % 360) * (Math.PI / 180);
  const radiusKm = 1.0 + ((Math.abs(hash) % 25) / 10.0); // 1.0 to 3.5 km
  const dLat = (radiusKm / 6371) * (180 / Math.PI);
  const dLng = dLat / Math.cos(toRad(hubCoord.lat));
  return {
    lat: hubCoord.lat + dLat * Math.sin(angle),
    lng: hubCoord.lng + dLng * Math.cos(angle)
  };
};

/**
 * Solves the Traveling Salesperson Problem (TSP) to find the shortest combined path
 * starting from the Hub, visiting each customer stop once, and returning to Hub.
 * Uses Nearest Neighbor initialization + 2-Opt local search heuristic.
 */
export const optimizeRouteOrder = (
  hub: HubLocation,
  rawStops: RouteStop[]
): OptimizedRouteResult => {
  if (rawStops.length === 0) {
    return {
      hub,
      orderedStops: [],
      totalDistanceKm: 0,
      totalEstMinutes: 0,
      masterGoogleMapsUrl: '',
      googleMapsLegsUrls: []
    };
  }

  // 1. Resolve Hub Coordinates
  let hubCoords = extractCoordinates(hub.locationLink);
  if (!hubCoords && hub.lat && hub.lng) {
    hubCoords = { lat: hub.lat, lng: hub.lng };
  }
  // Default fallback if no hub coords entered yet: Central Mumbai / or fallback coords
  if (!hubCoords) {
    hubCoords = { lat: 19.0760, lng: 72.8777 };
  }

  // 2. Prepare Stops with resolved coordinates
  const stopsWithCoords = rawStops.map((stop) => {
    let coords = extractCoordinates(stop.locationLink);
    let hasExact = true;
    if (!coords) {
      hasExact = false;
      // Cluster by area relative to hub
      coords = getAreaClusterOffset(hubCoords!, stop.area || stop.address || stop.name);
    }
    return {
      ...stop,
      resolvedCoords: coords,
      hasExactCoordinates: hasExact
    };
  });

  const n = stopsWithCoords.length;

  // 3. Build Distance Matrix (Index 0 = Hub, 1..n = Stops)
  const allPoints: LatLng[] = [hubCoords, ...stopsWithCoords.map((s) => s.resolvedCoords)];
  const totalPoints = allPoints.length;
  const distMatrix: number[][] = Array.from({ length: totalPoints }, () => Array(totalPoints).fill(0));

  for (let i = 0; i < totalPoints; i++) {
    for (let j = 0; j < totalPoints; j++) {
      if (i === j) {
        distMatrix[i][j] = 0;
      } else {
        // Multiplier 1.3 accounts for actual road driving distance vs straight flight distance
        distMatrix[i][j] = calculateHaversineKm(allPoints[i], allPoints[j]) * 1.3;
      }
    }
  }

  // 4. Nearest Neighbor Heuristic starting from Hub (Index 0)
  const visited = new Set<number>();
  visited.add(0);
  const routeIndices: number[] = [];
  let current = 0;

  while (visited.size < totalPoints) {
    let nearestIdx = -1;
    let minD = Infinity;

    for (let i = 1; i < totalPoints; i++) {
      if (!visited.has(i)) {
        const d = distMatrix[current][i];
        if (d < minD) {
          minD = d;
          nearestIdx = i;
        }
      }
    }

    if (nearestIdx !== -1) {
      visited.add(nearestIdx);
      routeIndices.push(nearestIdx);
      current = nearestIdx;
    } else {
      break;
    }
  }

  // 5. 2-Opt Local Search Improvement for Stops
  // Route is [0, ...routeIndices, 0] (Hub -> stops -> Hub)
  let improved = true;
  let iterations = 0;
  const maxIterations = 50;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    for (let i = 0; i < routeIndices.length - 1; i++) {
      for (let k = i + 1; k < routeIndices.length; k++) {
        const prevPoint = i === 0 ? 0 : routeIndices[i - 1];
        const pointI = routeIndices[i];
        const pointK = routeIndices[k];
        const nextPoint = k === routeIndices.length - 1 ? 0 : routeIndices[k + 1];

        const currentDist = distMatrix[prevPoint][pointI] + distMatrix[pointK][nextPoint];
        const newDist = distMatrix[prevPoint][pointK] + distMatrix[pointI][nextPoint];

        if (newDist < currentDist - 0.01) {
          // Reverse subsegment from i to k
          reverseSubsegment(routeIndices, i, k);
          improved = true;
        }
      }
    }
  }

  // 6. Assemble Optimized Stop Sequence and Distance Metrics
  let cumulativeDist = 0;
  let prevIdx = 0;
  const orderedStops: OptimizedStop[] = [];

  routeIndices.forEach((stopPointIdx, rank) => {
    const rawStop = stopsWithCoords[stopPointIdx - 1];
    const legDist = distMatrix[prevIdx][stopPointIdx];
    cumulativeDist += legDist;

    // Estimate driving speed ~25 km/h in city plus 3 mins per delivery drop
    const estDriveMins = Math.round((legDist / 25) * 60) + 3;

    // Generate single-tap Google Maps Navigation URL for this stop
    let destQuery = '';
    if (rawStop.hasExactCoordinates && rawStop.resolvedCoords) {
      destQuery = `${rawStop.resolvedCoords.lat},${rawStop.resolvedCoords.lng}`;
    } else if (rawStop.locationLink && rawStop.locationLink.includes('http')) {
      destQuery = rawStop.locationLink;
    } else {
      destQuery = encodeURIComponent(`${rawStop.address}, ${rawStop.area || ''}`);
    }

    const directNavUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destQuery)}`;

    orderedStops.push({
      ...rawStop,
      sequence: rank + 1,
      distanceFromPrevKm: Number(legDist.toFixed(1)),
      estMinutesFromPrev: estDriveMins,
      cumulativeDistanceKm: Number(cumulativeDist.toFixed(1)),
      directNavUrl
    });

    prevIdx = stopPointIdx;
  });

  // Add final return leg back to Hub
  const returnToHubDist = distMatrix[prevIdx][0];
  const totalDistanceKm = Number((cumulativeDist + returnToHubDist).toFixed(1));
  const totalEstMinutes = Math.round((totalDistanceKm / 25) * 60) + (orderedStops.length * 3);

  // 7. Generate Master Google Maps Round-Trip Links
  const { masterUrl, legUrls } = buildGoogleMapsDirectionsUrls(hub, orderedStops);

  return {
    hub,
    orderedStops,
    totalDistanceKm,
    totalEstMinutes,
    masterGoogleMapsUrl: masterUrl,
    googleMapsLegsUrls: legUrls
  };
};

const reverseSubsegment = (arr: number[], i: number, k: number) => {
  while (i < k) {
    const temp = arr[i];
    arr[i] = arr[k];
    arr[k] = temp;
    i++;
    k--;
  }
};

/**
 * Creates Google Maps multi-stop URL(s) for the round trip.
 * Google Maps URL directions format:
 * https://www.google.com/maps/dir/?api=1&origin=HUB&destination=HUB&waypoints=STOP1|STOP2|...
 */
const buildGoogleMapsDirectionsUrls = (
  hub: HubLocation,
  stops: OptimizedStop[]
): { masterUrl: string; legUrls: string[] } => {
  const getPointQuery = (point: { address?: string; locationLink?: string; resolvedCoords?: LatLng }): string => {
    if (point.resolvedCoords) {
      return `${point.resolvedCoords.lat.toFixed(5)},${point.resolvedCoords.lng.toFixed(5)}`;
    }
    const coords = extractCoordinates(point.locationLink);
    if (coords) {
      return `${coords.lat.toFixed(5)},${coords.lng.toFixed(5)}`;
    }
    return encodeURIComponent(point.address || 'Kitchen Hub');
  };

  const hubQuery = getPointQuery({
    address: hub.address || hub.name,
    locationLink: hub.locationLink,
    resolvedCoords: hub.lat && hub.lng ? { lat: hub.lat, lng: hub.lng } : extractCoordinates(hub.locationLink) || undefined
  });

  // Google Maps URL directions can reliably hold up to 9 waypoints between origin & destination
  const WAYPOINT_CHUNK_SIZE = 9;
  const legUrls: string[] = [];

  for (let i = 0; i < stops.length; i += WAYPOINT_CHUNK_SIZE) {
    const chunk = stops.slice(i, i + WAYPOINT_CHUNK_SIZE);
    const isFirstChunk = i === 0;
    const isLastChunk = i + WAYPOINT_CHUNK_SIZE >= stops.length;

    const chunkOrigin = isFirstChunk ? hubQuery : getPointQuery(stops[i - 1]);
    const chunkDestination = isLastChunk ? hubQuery : getPointQuery(stops[Math.min(i + WAYPOINT_CHUNK_SIZE, stops.length - 1)]);

    // Intermediate waypoints inside the chunk
    const waypoints = chunk
      .slice(0, isLastChunk ? chunk.length : chunk.length - 1)
      .map((s) => getPointQuery(s))
      .join('|');

    let url = `https://www.google.com/maps/dir/?api=1&origin=${chunkOrigin}&destination=${chunkDestination}`;
    if (waypoints) {
      url += `&waypoints=${waypoints}`;
    }
    legUrls.push(url);
  }

  // Master URL combining the first chunk or all if <= 9
  const first9Waypoints = stops.slice(0, 9).map((s) => getPointQuery(s)).join('|');
  let masterUrl = `https://www.google.com/maps/dir/?api=1&origin=${hubQuery}&destination=${hubQuery}`;
  if (first9Waypoints) {
    masterUrl += `&waypoints=${first9Waypoints}`;
  }

  return { masterUrl, legUrls };
};

/**
 * Prepares WhatsApp formatted text with the shortest route sequence and navigation links
 */
export const formatWhatsAppOptimizedRoute = (
  mealTime: string,
  dateStr: string,
  deliveryBoy: { name: string; mobile?: string },
  routeResult: OptimizedRouteResult
): string => {
  const { hub, orderedStops, totalDistanceKm, totalEstMinutes, masterGoogleMapsUrl, googleMapsLegsUrls } = routeResult;

  // Calculate box recollection statistics
  let totalRecollectionsToday = 0;
  let totalDay1NewBoxes = 0;

  orderedStops.forEach((stop) => {
    const sessionPlans = stop.activePlans?.filter((p: any) => p.mealTime === mealTime) || [];
    sessionPlans.forEach((p: any) => {
      if (p.reusableBoxType && p.reusableBoxType !== 'None') {
        const dayNum = getPlanDeliveryDayNumber(p.startDate, dateStr, p.weekdays || [1, 2, 3, 4, 5, 6], p.pauses || []);
        if (dayNum >= 2) {
          totalRecollectionsToday++;
        } else if (dayNum === 1) {
          totalDay1NewBoxes++;
        }
      }
    });
  });

  let msg = `🚚 *SHORTEST ROUTE DISPATCH - ${mealTime.toUpperCase()}*\n`;
  msg += `👤 Partner: *${deliveryBoy.name}*\n`;
  msg += `📅 Date: ${dateStr}\n`;
  msg += `📍 Hub: *${hub.name}* (Round Trip: Hub ➔ Orders ➔ Hub)\n`;
  msg += `📦 Total Orders: *${orderedStops.length} Customers*\n`;
  if (totalRecollectionsToday > 0) {
    msg += `🔄 *REUSABLE BOXES TO RECOLLECT: ${totalRecollectionsToday} Boxes* (Day 2+ drops)\n`;
  }
  if (totalDay1NewBoxes > 0) {
    msg += `🟢 *Day 1 New Subscriptions: ${totalDay1NewBoxes} Boxes* (Issue new box, no previous box)\n`;
  }
  msg += `🛣️ Est. Distance: *~${totalDistanceKm} km* (~${totalEstMinutes} mins)\n\n`;

  msg += `🗺️ *ONE-TAP GOOGLE MAPS MASTER ROUTE:*\n${masterGoogleMapsUrl}\n\n`;

  if (googleMapsLegsUrls.length > 1) {
    msg += `🗺️ *ROUTE SECTIONS:*\n`;
    googleMapsLegsUrls.forEach((u, idx) => {
      msg += `• Leg ${idx + 1}: ${u}\n`;
    });
    msg += `\n`;
  }

  msg += `────────────────────────\n`;
  msg += `📋 *OPTIMIZED DELIVERY SEQUENCE:*\n\n`;

  orderedStops.forEach((stop, i) => {
    const sessionPlans = stop.activePlans?.filter((p: any) => p.mealTime === mealTime) || [];
    const plansCount = sessionPlans.length || 1;
    const planNames = sessionPlans
      .map((p: any) => `${p.planName}${p.isStarred ? ' ⭐' : ''}`)
      .join(', ') || 'Tiffin Box';

    msg += `${i + 1}️⃣ *${stop.name}* [${plansCount} Box${plansCount > 1 ? 'es' : ''}]\n`;
    msg += `   🍱 Plan: ${planNames}\n`;
    msg += `   📍 Address: ${stop.address}${stop.area ? `, ${stop.area}` : ''}\n`;
    msg += `   📞 Call: ${stop.mobile}\n`;

    // Reusable Box Instructions
    sessionPlans.forEach((p: any) => {
      const boxType = p.reusableBoxType || 'None';
      if (boxType && boxType !== 'None') {
        const dayNum = getPlanDeliveryDayNumber(p.startDate, dateStr, p.weekdays || [1, 2, 3, 4, 5, 6], p.pauses || []);
        if (dayNum === 1) {
          msg += `   🟢 *BOX: ${boxType}* (Day 1: First Delivery - Issue Fresh Box, NO yesterday box to collect)\n`;
        } else if (dayNum >= 2) {
          msg += `   ⚠️ *RECOLLECT: Yesterday's ${boxType}* (Day ${dayNum} of subscription)\n`;
          msg += `      👉 Check: Clean & intact? (Inspect for missing lid/parts or unclean)\n`;
        } else {
          msg += `   📦 *Box:* ${boxType}\n`;
        }
      }
    });

    if (stop.notes) {
      msg += `   📝 Note: ${stop.notes}\n`;
    }
    msg += `   🧭 Direct Nav: ${stop.directNavUrl}\n\n`;
  });

  msg += `🏁 *Final Stop: Return back to ${hub.name}*\n`;
  msg += `✨ *Generated by ScaleKitchen Route Optimizer*`;

  return msg;
};
