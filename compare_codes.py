import re

# Коды из БД (42 кода)
db_codes = set("""2YA3DEX5
3ES8VBV2
4AYJKQVM
4C35NHZK
4U2T34PP
54AW2SJ5
5NNFXYF9
5SZ6GXDN
6P4CRTY7
7RHR3DFU
8D6QP85C
8EDXGW8P
8SAA8LZL
9ECKJGR9
A93UGTGQ
AYP2WFE5
BF3QPQ6X
BKBEFQEC
C5LEMJZU
DGGXFMYT
EKNNXRQ6
EX9NMMT3
F7CS6RL2
FWWJ55FU
H9YDYX2E
HRCXUQDG
JDKF8E4F
JMUNCZK6
JX9FLZGH
LBXNLCDY
MH8BLY45
NJK8YWLZ
P76BXQUZ
QRSHGTXS
RNYNWV6C
RZWXFBGZ
SFY76AND
SLGAGY4D
SNNEJGAQ
UB6RDEJ4
UWYHR6TH
WEL7HT43""".strip().split('\n'))

with open(r'C:\Users\Administrator\Downloads\farmerpanel\eldoradohighligh.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Коды на странице
page_codes = set(re.findall(r'#([A-Z0-9]{7,8})\b', content))

print(f"Codes in DB: {len(db_codes)}")
print(f"Codes on page: {len(page_codes)}")

# Коды на странице но НЕ в БД (это должны быть офферы других продавцов)
not_in_db = page_codes - db_codes
print(f"\nCodes on page but NOT in DB ({len(not_in_db)}):")
for c in sorted(not_in_db):
    print(f"  #{c}")

# Коды в БД но не на странице
not_on_page = db_codes - page_codes
print(f"\nCodes in DB but NOT on page ({len(not_on_page)}):")
for c in sorted(not_on_page):
    print(f"  #{c}")

# Общие коды
common = db_codes & page_codes
print(f"\nCommon codes: {len(common)}")
