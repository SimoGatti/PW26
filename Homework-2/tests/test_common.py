from unittest.mock import patch

from django.test import RequestFactory, SimpleTestCase
from quizapp.forms import UserForm
from quizapp.repositories.common import list_state
from quizapp.services.answer_order import randomize_question_answers, shuffled
from quizapp.services.quiz_attempt import start

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


class ReverseRandomizer:
    """Generatore deterministico usato per verificare lo shuffle."""

    def shuffle(self, values):
        values.reverse()


class SessionStub(dict):
    """Sessione minima per provare la preparazione del tentativo."""

    modified = False


class AnswerOrderTests(SimpleTestCase):
    def test_shuffled_returns_a_new_permutation(self):
        original = [1, 2, 3, 4]
        result = shuffled(original, ReverseRandomizer())
        self.assertEqual(result, [4, 3, 2, 1])
        self.assertEqual(original, [1, 2, 3, 4])

    def test_each_question_is_randomized_without_losing_answers(self):
        questions = [
            {"answers": [{"answer_number": 1}, {"answer_number": 2}]},
            {"answers": [{"answer_number": 3}, {"answer_number": 4}]},
        ]
        randomize_question_answers(questions, ReverseRandomizer())
        self.assertEqual(
            [[answer["answer_number"] for answer in item["answers"]] for item in questions],
            [[2, 1], [4, 3]],
        )

    @patch(
        "quizapp.services.quiz_attempt.secrets.SystemRandom",
        return_value=ReverseRandomizer(),
    )
    def test_attempt_stores_a_random_order_for_each_question(self, _randomizer):
        session = SessionStub()
        quiz = {
            "codice": 42,
            "question_list": [
                {
                    "number": 1,
                    "answers": [
                        {"answer_number": 1},
                        {"answer_number": 2},
                        {"answer_number": 3},
                    ],
                }
            ],
        }
        start(session, quiz, "alice")
        self.assertEqual(session["quiz_attempt"]["order"]["1"], [3, 2, 1])
        self.assertTrue(session.modified)
