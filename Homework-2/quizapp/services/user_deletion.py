"""Cancellazione fisica controllata dell'utente e delle dipendenze ammesse."""

from django.db import connection, transaction
from quizapp.repositories.users import deletion_preview

def delete_user(username):
    """Blocca i quiz partecipati ed elimina le altre dipendenze in ordine."""
    preview=deletion_preview(username)
    if not preview["allowed"]: raise ValueError("L'utente ha creato quiz già partecipati.")
    with transaction.atomic(), connection.cursor() as c:
        # Le foreign key sono RESTRICT: l'ordine esplicito rende visibili tutte
        # le dipendenze e impedisce cancellazioni a cascata involontarie.
        c.execute('DELETE FROM "RispostaUtenteQuiz" WHERE partecipazione IN (SELECT codice FROM "Partecipazione" WHERE utente=%s)',[username])
        c.execute('DELETE FROM "Partecipazione" WHERE utente=%s',[username])
        c.execute('DELETE FROM "Risposta" WHERE quiz IN (SELECT codice FROM "Quiz" WHERE creatore=%s)',[username])
        c.execute('DELETE FROM "Domanda" WHERE quiz IN (SELECT codice FROM "Quiz" WHERE creatore=%s)',[username])
        c.execute('DELETE FROM "Quiz" WHERE creatore=%s',[username])
        c.execute('DELETE FROM "Utente" WHERE "nomeUtente"=%s',[username])
