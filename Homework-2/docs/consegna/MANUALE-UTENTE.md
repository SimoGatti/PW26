# QUIZZING

## Manuale per l'utente

QUIZZING permette di consultare utenti, quiz e partecipazioni. Un quiz aperto
può essere svolto scegliendo l'utente.

## 1. Aprire l'applicazione

1. Avviare QUIZZING seguendo il documento `INSTALLAZIONE`.
2. Aprire un browser recente.
3. Digitare `http://127.0.0.1:8000/`.
4. Verificare la presenza della pagina Home.

La navigazione contiene quattro voci:

- **Home**: presentazione e conteggi principali;
- **Utenti**: ricerca e gestione dei profili;
- **Quiz**: ricerca e svolgimento dei quiz;
- **Partecipazioni**: consultazione dei tentativi conclusi.

## 2. Cercare e ordinare

1. Aprire Utenti, Quiz oppure Partecipazioni.
2. Inserire uno o più valori nel pannello Filtri.
3. Attendere l'aggiornamento dei risultati.
4. Premere **Pulisci filtri** per tornare all'elenco completo.

Premere il nome di una colonna per ordinare. La freccia colorata indica la
colonna selezionata e la direzione crescente o decrescente.

Usare **Compatta** per i dati essenziali. Usare **Estesa** per tutti i campi.
Usare le frecce di paginazione oppure digitare il numero della pagina nel campo
dedicato.

## 3. Consultare i dettagli

Premere un username per aprire il profilo. Il dettaglio mostra i quiz creati e
le partecipazioni effettuate.

Premere il titolo di un quiz per consultare periodo, stato, domande e
partecipanti. Premere **Mostra soluzioni** per visualizzare risposte corrette e
errate. Premere **Nascondi soluzioni** per nasconderle.

Premere l'icona di apertura di una partecipazione per consultare punteggio e
risposte. Aprire una domanda alla volta. Usare **Mostra soluzioni** per
confrontare le risposte date con le soluzioni.

## 4. Svolgere un quiz

1. Aprire Quiz.
2. Scegliere un quiz con stato **Aperto**.
3. Premere l'icona play oppure aprire il dettaglio e premere **Partecipa**.
4. Cercare un utente tramite username, nome o cognome.
5. Selezionare il risultato corretto.
6. Premere **Inizia**.
7. Rispondere a tutte le domande.
8. Premere **Invia risposte**.

Un cerchio permette una sola risposta. Una casella quadrata permette più
risposte. La partecipazione viene registrata soltanto dopo un invio valido.

Per interrompere:

1. premere **Abbandona quiz** nella parte alta della pagina;
2. premere **Continua il quiz** per tornare alle domande;
3. premere **Conferma abbandono** per eliminare la bozza.

L'abbandono non crea una partecipazione.

## 5. Gestire gli utenti

Premere **Nuovo utente** nell'elenco Utenti. Compilare username, nome, cognome
ed email. Lo username non può essere modificato dopo la creazione e deve essere univoco.

Aprire un profilo e premere l'icona matita per modificare nome, cognome o
email. Premere Indietro per annullare.

Premere l'icona cestino per richiedere l'eliminazione. Leggere il riepilogo
delle dipendenze. La cancellazione viene bloccata quando un quiz creato
dall'utente possiede partecipazioni. Nessun dato viene eliminato in quel caso.

## 6. Risolvere i problemi d'uso

### La pagina non si apre

Controllare che il terminale mostri l'indirizzo
`http://127.0.0.1:8000/`. Ripetere l'avvio descritto in `INSTALLAZIONE`.

### Un quiz non mostra Partecipa

Controllare lo stato. Soltanto un quiz Aperto può essere svolto.

### L'invio non procede

Leggere il messaggio nella pagina e rispondere a ogni domanda. Non aggiornare
manualmente l'indirizzo durante il tentativo.

### I risultati non corrispondono alla ricerca

Premere Pulisci filtri e inserire nuovamente i valori.

### Una tabella non entra nello schermo

Scorrere la tabella in orizzontale. Non scorrere l'intera pagina.
