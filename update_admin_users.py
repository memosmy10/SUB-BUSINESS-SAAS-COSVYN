with open('pages/admin/AdminUsers.tsx', 'r') as f:
    text = f.read()

text = text.replace(
    "import { getDaysDifference } from '../../services/store';",
    "import { getDaysDifference, formatDateDDMMYYYY } from '../../services/store';"
)

text = text.replace(
    '<span className="text-[10px] text-slate-500 mt-0.5">{t.planExpiryDate}</span>',
    '<span className="text-[10px] text-slate-500 mt-0.5">{formatDateDDMMYYYY(t.planExpiryDate)}</span>'
)

text = text.replace(
    "{loginHistoryBiz.trialStartDate || loginHistoryBiz.createdAt?.split('T')[0] || (Array.isArray(loginHistoryBiz.recentLoginDates) ? [...loginHistoryBiz.recentLoginDates].sort()[0] : 'N/A')}",
    "{formatDateDDMMYYYY(loginHistoryBiz.trialStartDate || loginHistoryBiz.createdAt?.split('T')[0] || (Array.isArray(loginHistoryBiz.recentLoginDates) ? [...loginHistoryBiz.recentLoginDates].sort()[0] : '')) || 'N/A'}"
)

text = text.replace(
    "{loginHistoryBiz.planExpiryDate || 'N/A'}",
    "{formatDateDDMMYYYY(loginHistoryBiz.planExpiryDate) || 'N/A'}"
)

text = text.replace(
    '<span className="font-mono text-slate-200">{date}</span>',
    '<span className="font-mono text-slate-200">{formatDateDDMMYYYY(date)}</span>'
)

text = text.replace(
    'Recorded login on ${loginHistoryBiz.lastLoginDate}. Ongoing tracking enabled.',
    'Recorded login on ${formatDateDDMMYYYY(loginHistoryBiz.lastLoginDate)}. Ongoing tracking enabled.'
)

with open('pages/admin/AdminUsers.tsx', 'w') as f:
    f.write(text)

print('SUCCESS')
