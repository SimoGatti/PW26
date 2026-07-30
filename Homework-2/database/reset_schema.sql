\echo 'ATTENZIONE: reset distruttivo dello schema applicativo QUIZZING.'
\echo 'Questo file elimina definitivamente tutte le tabelle e i dati applicativi.'
\prompt 'Per continuare digitare esattamente RESET QUIZZING: ' confirmation

SELECT :'confirmation' = 'RESET QUIZZING' AS confirmed \gset
\if :confirmed
  DROP TABLE IF EXISTS "RispostaUtenteQuiz";
  DROP TABLE IF EXISTS "Partecipazione";
  DROP TABLE IF EXISTS "Risposta";
  DROP TABLE IF EXISTS "Domanda";
  DROP TABLE IF EXISTS "Quiz";
  DROP TABLE IF EXISTS "Utente";
  \ir init_schema.sql
  \echo 'Reset completato. I dati applicativi precedenti non sono recuperabili.'
\else
  \echo 'Conferma non valida: nessuna modifica eseguita.'
\endif
