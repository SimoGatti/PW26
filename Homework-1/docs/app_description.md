# Descrizione Applicazione

## Utente
L'applicazione è pensata per utenti che vogliono consultare, cercare e svolgere quiz online. Ogni utente può essere selezionato come contesto attivo per navigare tra le varie sezioni del sito, visualizzare i quiz disponibili e monitorare le proprie partecipazioni.

Il progetto gestisce anche gli utenti in ottica amministrativa: è possibile consultarli, filtrare i risultati e abilitare o disabilitare un profilo tramite il campo `Attivo`.

## DB
Il database, definito nel file `data/quiz_mysql.sql`, è organizzato in modo relazionale e memorizza tutte le informazioni richieste dall'applicazione quiz. In generale contiene:

- `Utente`: anagrafica degli utenti con `nomeUtente`, `nome`, `cognome`, `email` e stato di attivazione.
- `Quiz`: elenco dei quiz, con titolo, autore (`creatore`) e intervallo di validità (`dataInizio`, `dataFine`).
- `Domanda`: domande associate a ciascun quiz, identificate da un numero progressivo.
- `Risposta`: risposte possibili per ogni domanda, con distinzione tra risposte corrette e sbagliate e, per le corrette, un punteggio associato.
- `Partecipazione`: registra la partecipazione di un utente a un quiz in una certa data.
- `RispostaUtenteQuiz`: associa le risposte selezionate dall'utente durante una partecipazione.

Le relazioni principali collegano i quiz ai rispettivi creatori, le domande ai quiz, le risposte alle domande e le partecipazioni agli utenti e ai quiz svolti. Il modello permette quindi di ricostruire sia la struttura dei quiz sia l'andamento delle partecipazioni e dei punteggi.

## Interfaccia
L'interfaccia è strutturata secondo lo standard numero 2 della presentazione. La pagina principale presenta:

- una testata con il titolo dell'applicazione;
- una colonna laterale sinistra per la selezione dell'utente attivo e dei filtri;
- un'area centrale per la visualizzazione dei contenuti;
- una colonna laterale destra con la navigazione tra le sezioni principali;
- un footer con una nota informativa.

La navigazione consente di passare tra home, ricerca utenti, ricerca quiz, ricerca partecipazioni e gestione utenti. L'interfaccia utilizza icone, pannelli e contenuti dinamici caricati via JavaScript.

## Funzionalità
Le funzionalità principali dell'applicazione sono:

- ricerca e consultazione degli utenti;
- ricerca e visualizzazione dei quiz disponibili;
- visualizzazione delle partecipazioni effettuate (`richiesta extra`);
- gestione degli utenti con operazioni di modifica dello stato (`operazioni CRUD richieste`);
- avvio e compilazione di un quiz;
- visualizzazione di informazioni riassuntive e statistiche di base;
- filtraggio e ordinamento dei dati mostrati nelle varie sezioni.

L'applicazione è quindi pensata come una piattaforma didattica per esplorare quiz, partecipare alle prove e amministrare i dati collegati al sistema.
