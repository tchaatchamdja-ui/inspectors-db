"""
Migration SQLite → PostgreSQL
=============================
Usage :
    python migrate_to_postgres.py

Prérequis :
    - DATABASE_URL défini dans .env ou en variable d'environnement
    - La base PostgreSQL cible doit être vide (ou les tables inexistantes)
    - psycopg2-binary installé : pip install psycopg2-binary python-dotenv
"""

import os, sqlite3, sys
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("❌  psycopg2-binary requis : pip install psycopg2-binary")
    sys.exit(1)

BASE_DIR = Path(__file__).parent
SQLITE_PATH = BASE_DIR / "data" / "inspectors.db"
DATABASE_URL = os.environ.get("DATABASE_URL", "")

if not DATABASE_URL:
    print("❌  Variable DATABASE_URL non définie.")
    print("    Exemple : DATABASE_URL=postgresql://user:password@host:5432/dbname")
    sys.exit(1)

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

if not SQLITE_PATH.exists():
    print(f"❌  Base SQLite introuvable : {SQLITE_PATH}")
    sys.exit(1)

TABLES = [
    "users",
    "inspectors",
    "qualifications",
    "formateurs",
    "formateur_competences",
    "formateur_formations",
    "settings",
    "activity_log",
    "password_reset_requests",
]

def sqlite_rows(cur, table):
    cur.execute(f"SELECT * FROM {table}")
    cols = [d[0] for d in cur.description]
    return cols, cur.fetchall()

def pg_insert(pg_cur, table, cols, rows):
    if not rows:
        return 0
    placeholders = ", ".join(["%s"] * len(cols))
    col_names = ", ".join(cols)
    sql = f"INSERT INTO {table} ({col_names}) VALUES ({placeholders}) ON CONFLICT DO NOTHING"
    pg_cur.executemany(sql, rows)
    return len(rows)

def reset_sequences(pg_cur):
    """Reset PostgreSQL SERIAL sequences after bulk insert."""
    sequences = {
        "users": "users_id_seq",
        "inspectors": "inspectors_id_seq",
        "qualifications": "qualifications_id_seq",
        "formateurs": "formateurs_id_seq",
        "formateur_competences": "formateur_competences_id_seq",
        "formateur_formations": "formateur_formations_id_seq",
        "settings": "settings_id_seq",
        "activity_log": "activity_log_id_seq",
        "password_reset_requests": "password_reset_requests_id_seq",
    }
    for table, seq in sequences.items():
        pg_cur.execute(f"""
            SELECT setval('{seq}', COALESCE((SELECT MAX(id) FROM {table}), 1))
        """)

def main():
    print("=" * 55)
    print("  Migration SQLite → PostgreSQL")
    print("=" * 55)
    print(f"  Source  : {SQLITE_PATH}")
    print(f"  Cible   : {DATABASE_URL[:DATABASE_URL.find('@')+1]}***")
    print()

    # --- SQLite connection ---
    sq = sqlite3.connect(str(SQLITE_PATH))
    sq.row_factory = sqlite3.Row
    sq_cur = sq.cursor()

    # --- PostgreSQL connection ---
    try:
        pg = psycopg2.connect(DATABASE_URL)
        pg.autocommit = False
        pg_cur = pg.cursor()
    except Exception as e:
        print(f"❌  Connexion PostgreSQL échouée : {e}")
        sq.close()
        sys.exit(1)

    # --- Initialize PG schema via app.init_db() ---
    print("1/3  Initialisation du schéma PostgreSQL...")
    try:
        # Import app to trigger init_db()
        import app as flask_app
        flask_app.init_db()
        print("     Schéma créé ✓")
    except Exception as e:
        print(f"     ⚠️  init_db() : {e}")
        print("     Continuons quand même...")

    # Re-open pg connection (init_db may have closed it via pool)
    try:
        pg = psycopg2.connect(DATABASE_URL)
        pg.autocommit = False
        pg_cur = pg.cursor()
    except Exception as e:
        print(f"❌  Reconnexion PostgreSQL échouée : {e}")
        sq.close()
        sys.exit(1)

    print()
    print("2/3  Copie des données...")

    total = 0
    try:
        for table in TABLES:
            # Check table exists in SQLite
            sq_cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,))
            if not sq_cur.fetchone():
                print(f"     {table:<35} (table absente dans SQLite, ignorée)")
                continue

            cols, rows = sqlite_rows(sq_cur, table)

            # Temporarily disable foreign key checks in PG
            pg_cur.execute("SET session_replication_role = replica")

            n = pg_insert(pg_cur, table, cols, [tuple(r) for r in rows])
            total += n
            print(f"     {table:<35} {n:>5} ligne(s)")

        # Reset FK checks
        pg_cur.execute("SET session_replication_role = DEFAULT")

        print()
        print("3/3  Réinitialisation des séquences...")
        reset_sequences(pg_cur)

        pg.commit()
        print()
        print(f"✅  Migration terminée — {total} ligne(s) migrées.")

    except Exception as e:
        pg.rollback()
        print(f"\n❌  Erreur pendant la migration : {e}")
        import traceback; traceback.print_exc()
        sys.exit(1)
    finally:
        sq.close()
        pg_cur.close()
        pg.close()

if __name__ == "__main__":
    main()
