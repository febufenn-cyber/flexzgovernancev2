# Tamil Nadu Governance Grid

Django prototype for a multi-department Tamil Nadu district monitoring dashboard.

The bundled dataset is synthetic. District geometry comes from `data/tn_districts.json`, which contains the supplied 30-district Tamil Nadu SVG map.

## Run

```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_data
python manage.py runserver
```

Visit <http://127.0.0.1:8000/>, click the logo, and choose a role username from the suggestions:

- User ID: `Chief Secretary` or another listed role
- Password: `Demo12345`

Django admin is available at `/admin/` with:

- User ID: `admin`
- Password: `admin12345`

## Notes

- The active department is preserved through `?dept=`.
- The highlighted spike is computed at API read time as the highest `primary_value` for the active department.
- No frontend build step is required. The UI uses Django templates, vanilla JavaScript, and Chart.js from a CDN.
