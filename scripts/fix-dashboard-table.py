import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('src/pages/admin/AdminDashboardPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add table-fixed to the table
old_table = '<table className="w-full text-sm border-collapse border-spacing-0">'
new_table = '<table className="w-full table-fixed text-sm border-collapse border-spacing-0">'

# 2. Replace fixed widths on th elements with percentage-based widths
old_th1 = '<th className="px-4 py-3 text-left font-bold text-gray-600 w-20">'
new_th1 = '<th className="px-4 py-3 text-left font-bold text-gray-600 w-[14%]">'

old_th2 = '<th className="px-4 py-3 text-left font-bold text-gray-600 w-28">'
new_th2 = '<th className="px-4 py-3 text-left font-bold text-gray-600 w-[18%]">'

old_th3 = '<th className="px-4 py-3 text-left font-bold text-gray-600 w-24">'
new_th3 = '<th className="px-4 py-3 text-left font-bold text-gray-600 w-[17%]">'

old_th5 = '<th className="px-4 py-3 text-left font-bold text-gray-600">'
new_th5 = '<th className="px-4 py-3 text-left font-bold text-gray-600 w-[34%]">'

replacements = [
    (old_table, new_table),
    (old_th1, new_th1),
    (old_th2, new_th2),
    (old_th5, new_th5),
]

for old, new in replacements:
    if old in content:
        content = content.replace(old, new, 1)
        print(f'Replaced: {old[:50]}...')
    else:
        print(f'NOT FOUND: {old[:50]}...')

# th3 appears twice (유사도, 상태) - replace both with different widths
count = content.count(old_th3)
print(f'w-24 th occurrences: {count}')
# Replace first occurrence (유사도)
content = content.replace(old_th3, '<th className="px-4 py-3 text-left font-bold text-gray-600 w-[17%]">', 1)
# Replace second occurrence (상태)
content = content.replace(old_th3, '<th className="px-4 py-3 text-left font-bold text-gray-600 w-[17%]">', 1)
print('Both w-24 th replaced')

with open('src/pages/admin/AdminDashboardPage.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done!')
