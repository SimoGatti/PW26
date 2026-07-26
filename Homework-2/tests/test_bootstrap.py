import importlib.util
import os
import re
import tempfile
from pathlib import Path
from unittest import TestCase, mock


ROOT = Path(__file__).resolve().parent.parent


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


bootstrap = load_module(
    "quizzing_bootstrap",
    ROOT / "scripts" / "bootstrap-local.py",
)
importer = load_module(
    "quizzing_mysql_importer",
    ROOT / "database" / "import_mysql_dump.py",
)


class EnvironmentBootstrapTests(TestCase):
    def test_creates_uniform_dedicated_configuration(self):
        with tempfile.TemporaryDirectory() as directory:
            env_file = Path(directory) / ".env"
            with (
                mock.patch.object(bootstrap, "ENV_FILE", env_file),
                mock.patch.dict(
                    os.environ,
                    {
                        name: ""
                        for name in (
                            "POSTGRES_DB",
                            "POSTGRES_USER",
                            "POSTGRES_PASSWORD",
                            "POSTGRES_HOST",
                            "POSTGRES_PORT",
                        )
                    },
                    clear=False,
                ),
            ):
                # Le stringhe vuote ereditate non devono sostituire i valori
                # validi generati nel file.
                for name in (
                    "POSTGRES_DB",
                    "POSTGRES_USER",
                    "POSTGRES_PASSWORD",
                    "POSTGRES_HOST",
                    "POSTGRES_PORT",
                ):
                    os.environ.pop(name, None)
                values = bootstrap.ensure_environment()

            saved = env_file.read_text(encoding="utf-8")
            self.assertEqual(values["POSTGRES_DB"], "quizzing")
            self.assertEqual(values["POSTGRES_USER"], "quizzing_app")
            self.assertEqual(values["POSTGRES_HOST"], "127.0.0.1")
            self.assertEqual(values["POSTGRES_PORT"], "5432")
            self.assertGreaterEqual(len(values["POSTGRES_PASSWORD"]), 24)
            self.assertIn("POSTGRES_USER=quizzing_app", saved)

    def test_preserves_custom_socket_role_without_password(self):
        with tempfile.TemporaryDirectory() as directory:
            env_file = Path(directory) / ".env"
            env_file.write_text(
                "\n".join(
                    (
                        "POSTGRES_DB=quizzing",
                        "POSTGRES_USER=gatti",
                        "POSTGRES_PASSWORD=",
                        "POSTGRES_HOST=/tmp",
                        "POSTGRES_PORT=5432",
                    )
                )
                + "\n",
                encoding="utf-8",
            )
            names = (
                "POSTGRES_DB",
                "POSTGRES_USER",
                "POSTGRES_PASSWORD",
                "POSTGRES_HOST",
                "POSTGRES_PORT",
            )
            old_values = {name: os.environ.pop(name, None) for name in names}
            try:
                with mock.patch.object(bootstrap, "ENV_FILE", env_file):
                    values = bootstrap.ensure_environment()
            finally:
                for name, value in old_values.items():
                    if value is None:
                        os.environ.pop(name, None)
                    else:
                        os.environ[name] = value

            self.assertEqual(values["POSTGRES_USER"], "gatti")
            self.assertEqual(values["POSTGRES_PASSWORD"], "")
            self.assertEqual(values["POSTGRES_HOST"], "/tmp")


class SchemaSafetyTests(TestCase):
    def test_initial_schema_contains_no_destructive_statements(self):
        source = (ROOT / "database" / "init_schema.sql").read_text(
            encoding="utf-8"
        )
        destructive = re.compile(
            r"^\s*(?:DROP|TRUNCATE|DELETE|UPDATE)\b",
            re.IGNORECASE | re.MULTILINE,
        )
        self.assertIsNone(destructive.search(source))

    def test_role_password_ddl_does_not_use_bind_parameters(self):
        source = (ROOT / "scripts" / "bootstrap-local.py").read_text(
            encoding="utf-8"
        )
        self.assertNotIn('CREATE ROLE {} LOGIN PASSWORD %s', source)
        self.assertNotIn('ALTER ROLE {} PASSWORD %s', source)
        self.assertIn("sql.Literal(values[\"POSTGRES_PASSWORD\"])", source)


class InitialDatasetTests(TestCase):
    def test_bundled_dump_is_complete(self):
        dataset = ROOT / "database" / "data" / "quiz_mysql_expanded.sql"
        parsed = importer.statements(dataset)
        counts = {
            table: sum(len(rows) for _, rows in parsed[table])
            for table in importer.TABLES
        }
        self.assertEqual(
            counts,
            {
                "Utente": 2500,
                "Quiz": 516,
                "Domanda": 10000,
                "Risposta": 40000,
                "Partecipazione": 10000,
                "RispostaUtenteQuiz": 193788,
            },
        )
