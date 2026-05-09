import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('src/components/layout/Layout.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

rewards_nav_accent = [
    '  rewards: {\n',
    "    active: 'bg-gradient-to-br from-emerald-400 via-green-500 to-teal-600 shadow-lg shadow-emerald-400/30 ring-1 ring-white/25',\n",
    "    label: 'text-emerald-800',\n",
    '    inactive:\n',
    "      'bg-gradient-to-br from-emerald-50/98 to-teal-50/90 border border-emerald-200/50 shadow-sm shadow-emerald-100/40 hover:from-emerald-100/95 hover:to-teal-50/90',\n",
    "    iconInactive: 'text-emerald-600/80 group-hover:text-emerald-800',\n",
    "    labelInactive: 'text-emerald-600/65 group-hover:text-emerald-900',\n",
    '  },\n',
]

rewards_nav_accent_ld = [
    '  rewards: {\n',
    '    active:\n',
    "      'bg-gradient-to-br from-emerald-400 via-teal-500 to-green-700 shadow-lg shadow-emerald-500/35 ring-1 ring-white/20',\n",
    "    label: 'text-emerald-50',\n",
    '    inactive:\n',
    "      'border border-slate-700/80 bg-slate-900/55 shadow-sm hover:border-emerald-600/45 hover:bg-slate-800/70',\n",
    "    iconInactive: 'text-emerald-200/75 group-hover:text-emerald-100',\n",
    "    labelInactive: 'text-slate-400 group-hover:text-emerald-100/90',\n",
    '  },\n',
]

notice_navitem_lines = [
    '\n',
    '        <NavItem\n',
    '          to="/notice"\n',
    '          icon={Megaphone}\n',
    '          label="공지"\n',
    "          active={isActive('/notice')}\n",
    '          accent={navAcc.notice}\n',
    '        />\n',
]

rewards_navitem_lines = [
    '        <NavItem\n',
    '          to="/rewards"\n',
    '          icon={Gift}\n',
    '          label="리워드"\n',
    "          active={isActive('/rewards')}\n",
    '          accent={navAcc.rewards}\n',
    '        />\n',
]

# Step 1: Insert rewards into NAV_ACCENTS
# Find "  }," followed by "}" that closes NAV_ACCENTS (after my block)
# Line 172 is index 171 (0-based: "  },") and 173 is index 172 ("}")
# Insert before index 172
lines = lines[:172] + rewards_nav_accent + lines[172:]
print(f"NAV_ACCENTS: inserted rewards at line 173")

# Step 2: After insertion (+8 lines), NAV_ACCENTS_LD ends at original line 244 = index 243
# Now it's at index 243 + 8 = 251
lines = lines[:251] + rewards_nav_accent_ld + lines[251:]
print(f"NAV_ACCENTS_LD: inserted rewards at line 252")

# Step 3: Find and remove notice NavItem, replace with rewards NavItem
notice_start = -1
notice_end = -1
for i, line in enumerate(lines):
    if 'to="/notice"' in line:
        j = i - 1
        while j >= 0 and '<NavItem' not in lines[j]:
            j -= 1
        notice_start = j
        k = i
        while k < len(lines) and '/>' not in lines[k]:
            k += 1
        notice_end = k + 1
        print(f'Notice NavItem found: lines {j+1} to {k+1}')
        break

# Include leading newline if present
if notice_start > 0 and lines[notice_start - 1].strip() == '':
    notice_start -= 1

# Replace notice block with rewards block (no leading newline since we'll add it)
lines = lines[:notice_start] + ['\n'] + rewards_navitem_lines + lines[notice_end:]
print('Notice replaced with rewards NavItem')

# Step 4: Find the bell button closing </button> and insert notice after it
bell_end = -1
in_bell = False
for i, line in enumerate(lines):
    if 'openNotificationPanel' in line:
        in_bell = True
    if in_bell and '</button>' in line:
        bell_end = i
        print(f'Bell button ends at line {i+1}')
        in_bell = False
        break

if bell_end >= 0:
    lines = lines[:bell_end+1] + notice_navitem_lines + lines[bell_end+1:]
    print('Notice NavItem inserted after bell button')

with open('src/components/layout/Layout.jsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print('Done!')
