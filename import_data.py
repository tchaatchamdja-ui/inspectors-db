"""Import inspector data from the Excel file into SQLite database."""
import os, sqlite3, re
import bcrypt
import openpyxl

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'data', 'inspectors.db')
EXCEL_PATH = os.path.join(BASE_DIR, '..', 'Base de donnée.xlsx')

os.makedirs(os.path.join(BASE_DIR, 'data'), exist_ok=True)

db = sqlite3.connect(DB_PATH)
db.row_factory = sqlite3.Row
db.execute("PRAGMA foreign_keys = ON")

# Init tables
db.executescript("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'National 2',
        is_active INTEGER NOT NULL DEFAULT 1, must_change_password INTEGER NOT NULL DEFAULT 1,
        inspector_id INTEGER, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS inspectors (
        id INTEGER PRIMARY KEY AUTOINCREMENT, reference TEXT UNIQUE NOT NULL,
        nom TEXT NOT NULL, prenom TEXT NOT NULL, etat TEXT NOT NULL,
        email TEXT, telephone TEXT, cv_path TEXT, is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS qualifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT, inspector_id INTEGER NOT NULL,
        domaine TEXT NOT NULL, specialite TEXT NOT NULL, niveau TEXT NOT NULL,
        experience TEXT, FOREIGN KEY (inspector_id) REFERENCES inspectors(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS activity_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, action TEXT NOT NULL,
        details TEXT, created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS password_reset_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, email TEXT NOT NULL,
        phone TEXT NOT NULL, token TEXT, status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT (datetime('now'))
    );
""")

# Create admin
admin = db.execute("SELECT id FROM users WHERE username = 'Admin'").fetchone()
if not admin:
    pw = bcrypt.hashpw('admin'.encode(), bcrypt.gensalt()).decode()
    db.execute("INSERT INTO users (username, password, role, must_change_password) VALUES ('Admin', ?, 'Administrateur', 0)", (pw,))
    print("Admin créé (Admin / admin)")

db.commit()

# Read Excel
print(f"Lecture du fichier: {EXCEL_PATH}")
wb = openpyxl.load_workbook(EXCEL_PATH, data_only=True)
ws = wb['Collecte']

def parse_name(full_name):
    """Split full name into nom (lastname) and prenom (firstname).
    Handles two patterns:
    - Last name first (uppercase): 'DREY Innocent' -> nom=DREY, prenom=Innocent
    - Last name last (uppercase): 'Youssouf Yoro TRAORE' -> nom=TRAORE, prenom=Youssouf Yoro
    """
    parts = full_name.strip().split()
    if len(parts) <= 1:
        return full_name.strip(), ''

    def is_upper(word):
        clean = word.replace("'", "").replace("'", "")
        return clean == clean.upper() and len(clean) > 1

    # Check if first word is uppercase -> pattern "NOM Prenom"
    first_upper = is_upper(parts[0]) or parts[0].startswith("d'") or parts[0].startswith("D'")

    if first_upper:
        # Last name at beginning: collect uppercase words
        nom_parts = []
        prenom_parts = []
        found_prenom = False
        for p in parts:
            if not found_prenom and (is_upper(p) or p.startswith("d'") or p.startswith("D'")):
                nom_parts.append(p)
            else:
                found_prenom = True
                prenom_parts.append(p)
        if not prenom_parts and len(nom_parts) > 1:
            prenom_parts = [nom_parts[-1]]
            nom_parts = nom_parts[:-1]
        return ' '.join(nom_parts), ' '.join(prenom_parts)
    else:
        # Last name at end: collect uppercase words from the end
        nom_parts = []
        prenom_parts = []
        for p in reversed(parts):
            if is_upper(p) and not prenom_parts:
                nom_parts.insert(0, p)
            else:
                prenom_parts.insert(0, p)
        if not nom_parts:
            # All mixed case - treat last word as nom
            return parts[-1], ' '.join(parts[:-1])
        return ' '.join(nom_parts), ' '.join(prenom_parts)

ref_num = 1
count = 0
seen = {}

for row in ws.iter_rows(min_row=4, values_only=True):
    etat = str(row[0] or '').strip()
    domaine = str(row[1] or '').strip()
    nom_complet = str(row[2] or '').strip()
    specialite = str(row[3] or '').strip()
    niveau = str(row[4] or '').strip()
    experience = str(row[5] or '').strip()
    contacts = str(row[6] or '').strip() if len(row) > 6 else ''

    if not etat or not nom_complet or etat == 'Etat':
        continue

    nom, prenom = parse_name(nom_complet)
    if not nom:
        continue

    # Parse contacts
    email = ''
    telephone = ''
    if contacts:
        email_match = re.search(r'[\w.\-+]+@[\w.\-]+', contacts)
        if email_match:
            email = email_match.group()
        phone_match = re.search(r'[\d\s+\-()]{8,}', contacts)
        if phone_match:
            telephone = phone_match.group().strip()

    key = (nom, prenom, etat)
    if key in seen:
        inspector_id = seen[key]
    else:
        ref = f"UEMOA-INS-{ref_num:04d}"
        ref_num += 1
        try:
            cursor = db.execute("INSERT INTO inspectors (reference, nom, prenom, etat, email, telephone) VALUES (?, ?, ?, ?, ?, ?)",
                (ref, nom, prenom, etat, email or None, telephone or None))
            inspector_id = cursor.lastrowid
            seen[key] = inspector_id
            count += 1

            if email:
                pw = bcrypt.hashpw(etat.encode(), bcrypt.gensalt()).decode()
                try:
                    db.execute("INSERT INTO users (username, password, role, must_change_password, inspector_id) VALUES (?, ?, 'National 2', 1, ?)",
                        (email, pw, inspector_id))
                except sqlite3.IntegrityError:
                    pass
        except sqlite3.IntegrityError as e:
            print(f"  Doublon ignoré: {nom_complet} - {e}")
            continue

    if domaine and specialite:
        db.execute("INSERT INTO qualifications (inspector_id, domaine, specialite, niveau, experience) VALUES (?, ?, ?, ?, ?)",
            (inspector_id, domaine, specialite, niveau, experience))

db.commit()

# Stats
print(f"\nImport terminé: {count} inspecteurs importés")
total = db.execute("SELECT COUNT(*) as c FROM inspectors").fetchone()['c']
print(f"Total inspecteurs: {total}")
for row in db.execute("SELECT etat, COUNT(*) as c FROM inspectors GROUP BY etat ORDER BY etat"):
    print(f"  {row['etat']}: {row['c']}")
user_count = db.execute("SELECT COUNT(*) as c FROM users").fetchone()['c']
print(f"Total utilisateurs: {user_count}")

db.close()
print("\nTerminé ! Lancez l'application avec: python app.py")
