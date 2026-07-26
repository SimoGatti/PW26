"""Ordinamento casuale delle risposte senza alterarne gli identificativi."""

import secrets


def shuffled(values, randomizer=None):
    """Restituisce una nuova lista mescolata con un generatore sicuro."""
    result = list(values)
    (randomizer or secrets.SystemRandom()).shuffle(result)
    return result


def randomize_question_answers(questions, randomizer=None):
    """Mescola in modo indipendente le risposte di ogni domanda."""
    randomizer = randomizer or secrets.SystemRandom()
    for question in questions:
        question["answers"] = shuffled(question["answers"], randomizer)
    return questions
