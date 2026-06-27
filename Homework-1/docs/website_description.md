# Descrizione Sito Web

## Utente
Il sito web è pensato per utenti che vogliono consultare, cercare e svolgere quiz online. Ogni utente può essere selezionato come attivo per navigare tra le varie sezioni del sito, visualizzare e svolgere i quiz disponibili e monitorare le partecipazioni.
È presente anche una sezione di gestione utenti, pensata per amministrare i profili presenti nel sistema.

## Struttura del database
Il database, definito nel file `quiz_mysql.sql`, è organizzato in modo relazionale e memorizza tutte le informazioni richieste dal sito. In generale contiene:

- `Utente`: anagrafica degli utenti con `nomeUtente`, `nome`, `cognome`, `email` e stato di attivazione.
- `Quiz`: elenco dei quiz, con titolo, autore (`creatore`) e intervallo di validità (`dataInizio`, `dataFine`).
- `Domanda`: domande associate a ciascun quiz, identificate da un numero progressivo.
- `Risposta`: risposte possibili per ogni domanda, con distinzione tra risposte corrette e sbagliate e, per le corrette, un punteggio associato.
- `Partecipazione`: registra la partecipazione di un utente a un quiz in una certa data.
- `RispostaUtenteQuiz`: associa le risposte selezionate dall'utente durante una partecipazione.

Le relazioni principali collegano i quiz ai rispettivi creatori, le domande ai quiz, le risposte alle domande e le partecipazioni agli utenti e ai quiz svolti. Il modello permette quindi di ricostruire sia la struttura dei quiz sia l'andamento delle partecipazioni e dei punteggi.

### Modifiche rispetto allo schema originale
Rispetto allo schema originario assegnato, è stato aggiunto il campo `Attivo` nella tabella `Utente`, usato per gestire la disattivazione logica degli utenti senza perdere i riferimenti storici a quiz e partecipazioni.

## Interfaccia
L'interfaccia segue il layout assegnato di tipo 2:

- una testata con il titolo del sito web;
- una colonna laterale sinistra per la selezione dell'utente attivo e dei filtri;
- un'area centrale per la visualizzazione dei contenuti;
- una colonna laterale destra con la navigazione tra le sezioni principali;
- un footer con una nota informativa.

La navigazione consente di passare tra home, ricerca utenti, ricerca quiz, ricerca partecipazioni e gestione utenti. L'interfaccia utilizza icone, pannelli e contenuti dinamici caricati via JavaScript.

## Funzionalità principali
Il sito permette di:

- cercare e consultare utenti, quiz e partecipazioni;
- visualizzare i dettagli di un quiz, con domande e risposte possibili;
- visualizzare i dettagli di un utente, con quiz creati e partecipazioni effettuate;
- visualizzare i dettagli di una partecipazione;
- gestire gli utenti tramite operazioni CRUD;
- avviare lo svolgimento di un quiz e salvare le risposte selezionate;
- filtrare, ordinare e paginare i risultati.

Durante lo svolgimento di un quiz, le risposte vengono mostrate in ordine casuale per ogni partecipazione.

Il sito web è quindi pensato come una piattaforma didattica per esplorare quiz, partecipare alle prove e amministrare i dati collegati al sistema.

## Note sul popolamento
Il database è stato popolato in maniera massiva tramite uno script Python che genera il file SQL a partire da un dataset in formato JSON.