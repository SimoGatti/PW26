from django.test import RequestFactory, SimpleTestCase
from quizapp.forms import UserForm
from quizapp.repositories.common import list_state

class QueryStateTests(SimpleTestCase):
    def setUp(self): self.factory=RequestFactory()
    def test_invalid_parameters_use_safe_defaults(self):
        state=list_state(self.factory.get("/users/?page=-4&size=999&sort=sql&dir=drop"),{"username"},"username")
        self.assertEqual((state.page,state.size,state.sort,state.direction),(1,25,"username","asc"))
    def test_query_keeps_visible_state(self):
        state=list_state(self.factory.get("/users/?nome=Anna&page=2&size=50"),{"username"},"username")
        self.assertIn("nome=Anna",state.query(page=1))

class UserFormTests(SimpleTestCase):
    def test_update_form_has_no_mutable_username(self):
        self.assertNotIn("nomeUtente",UserForm(editing=True).fields)
    def test_create_requires_valid_email(self):
        form=UserForm({"nomeUtente":"alice","nome":"Alice","cognome":"Rossi","email":"no"})
        self.assertFalse(form.is_valid())
