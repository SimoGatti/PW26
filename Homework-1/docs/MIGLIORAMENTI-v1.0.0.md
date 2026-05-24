# miglioramenti-apportabili

## istruzioni

Completare i miglioramenti e tracciare per ogni miglioramento completato tutta l'esecuzione in [[MIGLIORAMENTI-COMPLETATI]] in modo dettagliato, rimuovendo il task eseguito dal documento attuale. Ogni riga puntata delle liste è un'unità di miglioramento.

## generico

- IMPORTANTE: NUMERI E DATE ALLINEATI A DESTRA
- IMPORTANTE: ASSICURARSI EVITARE SQL INJECTION
- IMPORTANTE: SEMPRE PULSANTE PER TORNARE ALLA PAGINA PRECEDENTE
- Evidenziare meglio la possibilità di cliccare i link per scoprire i dettaglio o usare indicazione testuale per spiegarlo

## home
--

## ricerca-utenti

- Ricerca testuale attualmente non funzionante (SQL Error)
- Ricerca testuale con un input box per campo/colonna (username, nome, cognome, email)
- Ricerca in base al numero di quiz creati e partecipazioni con slider o altro
- Ordinamento meglio gestirlo tramite click sulle colonne, più semplice, ordinato ed inuitivo
- Risultati per pagina meglio gestirli tramite box affiancata al simbolo "pagina successiva" e "pagina precedente"
- Ordinamento e risultati per pagina con applicazione filtro immediata, senza bisogno di usare pulsante cerca
- Ricerca testuale con applicazione filtro appena l'utente ha finito di scrivere, non ad ogni lettera scritta
- Pulsante "Pulisci Filtri" invece di "Reset"

## dettaglio-utenti 

- Applicare alla stessa maniera suggerita in [ricerca-utenti](#ricerca-utenti) l'ordinamento e i filtri di ricerca
- 2 modalità di visualizzazione dati sia in quiz creati che in partecipazioni: 
	- compatta: niente colonna codice e date, per ora solo il codice
	- estesa: tutte le colonne presenti

## dettaglio-quiz

- Validazione date e periodo per stato quiz (aperto, finito, futuro ecc..)
- Validazione partecipazione permessa in base allo stato del quiz
- Campo creatore in alto duplicato
- Campo domande collassabile ed espandibile
- Doppia vista campo domande:
	- Mostra soluzioni
	- Nascondi soluzioni
- Filtro "Vai a domanda" in base al numero, "Cerca domanda" in base al testo e "Cerca risposta" in base al testo

## dettaglio-partecipazione

- Filtri come in [dettaglio-quiz](#dettaglio-quiz)

## ricerca-quiz

- Applicare i filtri e l'ordinamento come in [ricerca-utenti](#ricerca-utenti) . Per valori fissi (esempio lo stato) usare combobox con opzioni fisse, per il resto input testuale o filtro nella forma adatta come sliders o simili per i numeri.
- Modalità estesa e compatta come in [dettaglio-utenti][#dettaglio-utenti] con
	- compatta: solo titolo, creatore, stato, domande
	- estesa: tutti i campi

## ricerca-partecipazioni

- Applicare i filtri e l'ordinamento come in [ricerca-utenti](#ricerca-utenti)
- Modalità estesa e compatta come in [dettaglio-utenti][#dettaglio-utenti] con
	- compatta: solo utente, quiz, risposte, punteggio
	- estesa: tutti i campi

## gestione-utenti
- Applicare i filtri e l'ordinamento come in [ricerca-utenti](#ricerca-utenti)
- Modifica trasforma i valori fissi di un record in campi editabili, invece di caricare i dati nel form di creazione nuovo utente.