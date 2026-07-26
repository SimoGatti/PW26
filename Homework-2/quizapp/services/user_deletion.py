from django.db import connection, transaction
from quizapp.repositories.users import deletion_preview

def delete_user(username):
    preview=deletion_preview(username)
    if not preview["allowed"]: raise ValueError("L'utente ha creato quiz già partecipati.")
    with transaction.atomic(), connection.cursor() as c:
        c.execute('DELETE FROM "RispostaUtenteQuiz" WHERE partecipazione IN (SELECT codice FROM "Partecipazione" WHERE utente=%s)',[username])
        c.execute('DELETE FROM "Partecipazione" WHERE utente=%s',[username])
        c.execute('DELETE FROM "Risposta" WHERE quiz IN (SELECT codice FROM "Quiz" WHERE creatore=%s)',[username])
        c.execute('DELETE FROM "Domanda" WHERE quiz IN (SELECT codice FROM "Quiz" WHERE creatore=%s)',[username])
        c.execute('DELETE FROM "Quiz" WHERE creatore=%s',[username])
        c.execute('DELETE FROM "Utente" WHERE "nomeUtente"=%s',[username])
