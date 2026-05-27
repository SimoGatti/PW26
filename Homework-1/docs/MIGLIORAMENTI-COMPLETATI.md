# MIGLIORAMENTI COMPLETATI

## Eseguiti in sessione del 2026-05-24

### #2 — SQL Injection
**Già protetto.** Tutto il backend usa PDO con prepared statements.

---

### #1 — Numeri e date allineati a destra
Classe `.col-numeric` in `components.css`. `renderTable` in `ui.js` applica `col.numeric = true` su colonne numeriche e di data.

---

### #3 — Pulsante "Torna indietro"
`createBackButton(label, view)` in `ui.js`. Aggiunto in: `renderQuizDetail`, `renderUserDetail`, `renderParticipationDetail`.

---

### #4 — Indicazione link cliccabili
`createLink` aggiunge `title="Clicca per i dettagli"` su ogni link generato.

---

### #5 — Fix ricerca testuale utenti
`fetch_users` in `api.php` riscritta con nomi di colonna qualificati e subquery corretta per il COUNT totale.

---

### #6 — Input per campo separato (username, nome, cognome, email)
`renderUserFilters` in `filters.js`: 4 input separati. `fetch_users` in `api.php`: parametri `fUsername`, `fNome`, `fCognome`, `fEmail`. `loadUsers` in `search.js`: legge i 4 valori via `getUserFilterParams()`.

---

### #7 — Slider filtro quiz/partecipazioni
4 slider range in `renderUserFilters`. `fetch_users` usa HAVING `quizMin/Max`, `partMin/Max`.

---

### #8 — Ordinamento via click sulle colonne
`renderTable` in `ui.js`: `<th>` cliccabili con icone ▲▼⇅. Stato sort persistente per sezione in `searchState` (search.js). Sort client-side in `renderUserDetail`.

---

### #9 — Paginazione con limit inline
`renderTable` in `ui.js` usa `buildTopBar` per mostrare conteggio risultati e select 10/25/50/100 sopra la tabella. I pulsanti precedente/successiva sono gestiti da `buildNavBar`.

---

### #10 — Debounce su input + filtri immediati su select
`debounce(fn, 400)` applicato in `filters.js` a tutti gli input testuali. I `<select>` triggerano immediatamente.

---

### #11 — "Pulisci Filtri" al posto di "Reset"
Rinominato in tutti i `renderXFilters`.

---

### #12 — Ordinamento click colonne in dettaglio-utenti
Tabelle quiz e partecipazioni dell'utente ordinabili via click colonna (client-side).

---

### #13 — Vista compatta / estesa in dettaglio-utenti
Toggle condiviso: Compatta (quiz creati con Titolo+Domande, partecipazioni con Quiz+Punteggio) vs Estesa (tutte le colonne disponibili).

---

### #14 — Blocco partecipazione per stato non aperto
Pulsante "Partecipa" disabilitato con messaggio se stato ≠ `aperto`. Campo `stato` aggiunto in `fetch_quiz_detail` con CASE/WHEN.

---

### #15 — Rimozione campo creatore duplicato
Nome e email del creatore integrati nel `detail-meta`. Blocco separato rimosso.

---

### #16 — Sezione domande collassabile
Domande wrappate in `<details open>` con `<summary>` cliccabile in quiz e partecipazione.

---

### #17 — Toggle mostra/nascondi soluzioni
Pulsante in `renderQuizDetail`. Classe `.solutions-hidden` nasconde risposte corrette e punteggi via CSS.

---

### #18 — Filtri domande client-side (quiz)
Barra filtri: N° domanda, testo domanda, testo risposta, pulsante "Pulisci Filtri". Applica `hidden-by-filter` in tempo reale.

---

### #19 — Filtri domande client-side (partecipazione)
Stessi filtri del #18 in `renderParticipationDetail`.

---

### #20 — Ricerca quiz: debounce, sort colonne, pagination inline
Debounce su testo in `renderQuizFilters`. `loadQuizzes` con sort e limit inline.

---

### #21 — Ricerca quiz: vista compatta / estesa
Compatta: Titolo, Creatore, Stato, Domande. Estesa: tutte le colonne.

---

### #22 — Ricerca partecipazioni: debounce, sort colonne, pagination inline
Debounce su testo in `renderParticipationFilters`. `loadParticipations` con sort e limit inline.

---

### #23 — Ricerca partecipazioni: vista compatta / estesa
Compatta: Utente, Quiz, Risposte, Punteggio. Estesa: tutte le colonne.

---

### #24 — Gestione utenti: filtro testo
Input `manage-filter-q` con debounce in sidebar che chiama `refreshManageUsers()`.

---

### #25 — Gestione utenti: modifica inline nella riga
`startInlineEdit` trasforma la riga in input editabili con Salva/Annulla. La sidebar non viene più usata per la modifica.

---

## Eseguiti in sessione del 2026-05-24 (Seconda fase)

### Generico
- **G1 Niente ricaricamento / flickering:** Aggiunta funzione `updateResultsContainer` in `search.js` che rimpiazza il contenuto di `.results-container` in-place, rimuovendo il reflow e flickering della pagina.
- **G2 Componente "a-b di n":** Aggiunto in `ui.js` la `table-top-bar` con le informazioni visualizzate prima della tabella.
- **G3 Filtro "Per Pagina" in alto:** Spostato/duplicato in alto a destra nel `table-top-bar`.
- **G4 Pulsanti Successiva/Precedente duplicati:** La paginazione (nav) viene ora inserita sia prima (top) che dopo (bottom) della tabella da `renderTable`.
- **G5 Pulsanti "Torna indietro" (history):** Aggiornato `createBackButton` in `ui.js` per usare nativamente `window.history.back()` con fallback se non c'è history.
- **G6 Pulsanti indietro compatti:** Rimosso il nome dinamico, sostituito con "← Indietro" e un tooltip contestuale.

### Ricerca Utenti
- **U1 Ordinamento email alfanumerico:** Inizialmente aggiunto il sorting per email; nella fase di coerenza successiva la colonna è stata lasciata visibile ma resa non ordinabile, come richiesto nelle note aperte.
- **U2 Range numerico slider con max da DB:** Aggiunto endpoint API locale `user_stats` per recuperare i MAX reali, applicati dinamicamente in `renderUserFilters`. La richiesta completa min+max da DB resta aperta in `MIGLIORAMENTI-v1.0.0.md`.
- **U3 Slider unico doppio cursore con ancore:** In CSS aggiunta `.dual-range` che posiziona in modo assoluto i track e sovrappone i due input native per simulare un range continuo (con percentili visualizzati sotto via `.range-anchors`).

### Dettaglio Utenti
- **DU1 Filtri pannello sinistro:** Spostata la ricerca testuale sui quiz creati e sulle partecipazioni dell'utente nel pannello a sinistra via `renderUserDetailFilters`. Il sort non è nel pannello: nella versione corrente è solo sulle colonne.
- **DU2 Glitch pulsante estesa-compatta:** Rimosso scroll-jump ricreando in-place i container, posizionando la bar fissa senza rimpiazzare il parent layout.

### Dettaglio Quiz
- **DQ1 Filtri nel pannello a sx:** Spostati i filtri ricerca testuale/risposta nel `filterContainer` (sx) tramite `renderQuizDetailFilters`.
- **DQ2 Filtri non funzionano:** Gli event listener ora vengono correttamente registrati in cascata una volta che i blocchi (e l'ID target) sono stati agganciati al DOM (`replaceChildren` effettuato preventivamente).
- **DQ3 Nascondi-mostra soluzioni (default nascoste):** Implementato con `.solutions-hidden` aggiunto di default. Il CSS non usa `display:none` sull'intero list-item, ma rimuove lo sfondo verde/bordo e nasconde solo lo span del punteggio.

### Dettaglio Partecipazione
- **DP1 Click su singola partecipazione:** Aggiunto `_clickRoute` in `loadParticipations` (array data source). `renderTable` in `ui.js` rileva la key e trasforma la riga intera (eccetto per ancore cliccabili testuali all'interno) in trigger navigazionale.

### Gestione Utenti
- **GU1 Switch modifica che fa muovere container:** Fissato con `height: 30px`, `box-sizing: border-box`, `line-height: 1` e `vertical-align: middle` nelle righe di editing `.inline-edit-input` e `td`.
- **GU2 Stessi filtri ordinamento:** Introdotto sorting client/server-side per la lista CRUD; la versione finale usa gli header della tabella come unico controllo di ordinamento.

---

## Eseguiti in sessione del 2026-05-24 (Coerenza pattern)

### Generico
- **Vista compatta di default:** `searchState` ora inizializza utenti, quiz e partecipazioni in modalità `compact`; anche il dettaglio utente parte in modalità compatta.
- **Ordinamento iniziale su colonne visibili:** ricerca quiz parte da `titolo`, ricerca partecipazioni da `punteggioTotale`, evitando ordinamenti default su campi nascosti nella vista compatta.

### Ricerca Utenti
- **Ordinamento email rimosso dalla tabella:** la colonna Email resta visibile nella vista estesa, ma non è più ordinabile via header per evitare il comportamento alfabetico non affidabile segnalato.

### Dettaglio Utenti
- **Compatta con titolo e numero domande:** la tabella dei quiz creati in modalità compatta mostra `Titolo` e `Domande`.
- **Ordinamento solo da colonne:** rimosso il select `ud-sort` dal pannello filtri; le tabelle interne usano soltanto il click sugli header ordinabili.
- **Filtri testuali separati:** il pannello laterale ora separa il filtro per titolo dei quiz creati dal filtro per titolo dei quiz svolti.

### Ricerca Quiz
- **Filtri testuali separati:** sostituita la ricerca testuale unica con input dedicati per `Titolo` e `Creatore`.
- **Filtro date:** aggiunti campi `Da` e `A`, inviati all'API come `dateFrom` e `dateTo` e applicati su `dataInizio`/`dataFine`.

### Ricerca Partecipazioni
- **Etichette date coerenti:** `Da data` e `A data` sono diventati `Da` e `A`.
- **Default date vuote:** i campi data restano vuoti finché l'utente non applica un filtro, quindi il valore visualizzato coincide con il filtro reale.
- **Filtri testuali separati:** sostituita la ricerca testuale unica con input dedicati per `Utente` e `Quiz`.

### Gestione Utenti
- **Ordinamento solo da colonne:** rimosso il select `manage-sort` dalla sidebar; la lista CRUD mantiene solo filtro testuale e ordinamento tramite header della tabella.

### Paginazione e Toolbar Risultati
- **Precedente/Successiva allineati al toggle vista:** il toggle `Compatta/Estesa` viene passato a `renderTable` come `viewToggle`; la toolbar superiore mostra il toggle a sinistra e i pulsanti di navigazione a destra sulla stessa riga quando lo spazio lo consente.
- **Navigatore pagine solo sotto i risultati:** `buildNavBar` ora aggiunge i pulsanti numerici delle pagine solo nella toolbar inferiore; la toolbar superiore mantiene soltanto `Precedente/Successiva`.
- **Responsive controllato:** sotto i 560px la toolbar collassa in verticale; su viewport 800px il controllo Chrome headless conferma toggle e pulsante `Successiva` sulla stessa riga senza overlap.

---

## Verifica effettiva del 2026-05-24

### Verificato localmente
- `node --check` passa sui file JS principali (`dom.js`, `api.js`, `filters.js`, `ui.js`, `search.js`, `users-crud.js`, `details.js`, `play.js`, `router-init.js`).
- `git diff --check` non segnala whitespace/errori di patch.
- Nel codice locale non risultano più `manage-sort`, `ud-sort`, `filter-q` nelle schermate rifatte, né default `extended` nelle ricerche principali.

### Verificato su Altervista
- `home`, `search_users`, `search_quizzes`, `search_participations`, `quiz_detail`, `user_detail` rispondono HTTP 200 con JSON valido.
- Le ricerche base con ordinamento usato come default corrente rispondono correttamente: utenti per `cognome`, quiz per `titolo`, partecipazioni per `punteggioTotale`.

### Riallineamento Altervista confermato
- `user_stats` su Altervista risponde HTTP 200 con `quizMax` e `partMax`.
- I filtri separati di `search_quizzes` (`fTitolo`, `creatore`, `dateFrom`, `dateTo`) risultano applicati sul remoto.
- I filtri separati di `search_participations` (`fUtente`, `fTitoloQuiz`, `dateFrom`, `dateTo`) risultano applicati sul remoto.

---

## Eseguiti in sessione del 2026-05-27

### Generico
- **Paginazione stabile e compatta:** in `ui.js` i pulsanti precedente/successivo sono sempre renderizzati e disabilitati quando non utilizzabili, così la toolbar non cambia larghezza. I pulsanti numerici sono stati ridotti e il navigatore mostra meno pagine attorno a quella corrente. In `components.css` sono state fissate dimensioni compatte per `.pagination-page` e `.pagination-nav-btn`.
- **Ancore slider dinamiche:** in `filters.js` è stata introdotta `buildRangeAnchors(min, max)`, che genera tutte le ancore per range piccoli e percentili univoci per range grandi, evitando duplicati come 0-3 con due valori uguali.
- **Date in formato GG/MM/AAAA:** il calendario custom ora scrive `gg/mm/aaaa` negli input; `filters.js` converte il formato display in ISO `yyyy-mm-dd` solo prima di inviare i parametri all'API, mantenendo il confronto con i dati DB. Aggiornato anche il prototipo in `experiments/date-picker.html` e `experiments/date-picker.js`.
- **Indietro dinamico:** `router-init.js` salva la route di provenienza nello stato history; `createBackButton` usa `navigateBack`, quindi i dettagli tornano alla schermata reale da cui l'utente è arrivato, con fallback solo se manca lo stato.

### Ricerca Utenti
- **Soft delete utenti con campo Attivo:** in `api.php` è stato aggiunto `ensure_user_active_column()`, che garantisce la presenza della colonna `Attivo` su `Utente`. `delete_user` ora imposta `Attivo = 0`, mentre ricerche utenti, gestione utenti e selettore utente mostrano solo record attivi.

### Dettaglio Quiz
- **Avviso partecipazione senza utente selezionato:** se l'utente prova a partecipare senza selezionare un utente, `details.js` mostra una schermata di avviso con pulsante Indietro dinamico e pulsante Continua. La selezione dell'utente dal pannello sinistro viene intercettata e abilita l'accesso al quiz dalla stessa schermata.
- **Limite risposte selezionabili:** in `play.js` ogni domanda calcola il numero di risposte corrette e impedisce di selezionare più checkbox di quel limite. In `api.php` la stessa regola viene validata lato server durante il salvataggio delle risposte.

### Ricerca Quiz
- **Pulsante dettaglio esplicito:** aggiunta una colonna azione fissa a sinistra, sia compatta sia estesa, con pulsante SVG leggero per aprire il dettaglio quiz.

### Ricerca Partecipazioni
- **Pulsante dettaglio esplicito e no click riga:** aggiunta una colonna azione con lente SVG per aprire il dettaglio partecipazione. Rimossa la navigazione cliccando lo spazio vuoto della riga; restano cliccabili solo i link espliciti e il nuovo pulsante.

### Gestione Utenti
- **Edit inline senza spostamenti:** gli input inline mantengono dimensioni controllate tramite `.inline-edit-input`; la riga conserva la struttura tabellare e l'editing resta stabile.
- **Username modificabile con cascata manuale:** `users-crud.js` rende editabile anche lo username. `api.php` gestisce il cambio creando il nuovo record utente, aggiornando `Quiz.creatore` e `Partecipazione.utente`, poi rimuovendo il vecchio record, preservando le foreign key anche senza cascade DB.

### Generico
- **Dettagli utenti eliminati ancora visitabili:** `fetch_user_detail` in `api.php` non filtra piu' per `Attivo = 1`, quindi i link storici da quiz creati e partecipazioni continuano ad aprire il dettaglio utente anche dopo il soft delete. Il dettaglio mostra un badge "Utente eliminato"; ricerche, gestione e selettore restano invece limitati agli utenti attivi.
- **Schema SQL riallineato:** `data/quiz_mysql.sql` e `data/generate_mysql.py` includono la colonna `Attivo TINYINT(1) NOT NULL DEFAULT 1` nella tabella `Utente`, coerente con la migrazione automatica gia' presente in `api.php`.
- **Toggle compatta/estesa senza reset filtri:** `filters.js` espone snapshot/restore dei valori di input e select; `search.js` e `details.js` passano i valori correnti quando cambiano modalita'. Ordinamento e direzione restano nello stato gia' esistente delle schermate.
- **Layout responsive con centro prioritario:** `responsive.css` riduce prima le colonne laterali sotto 1100px e sotto 900px porta la colonna centrale in cima, con altezza minima dedicata, cosi' quando la finestra viene stretta la componente principale resta la piu' visibile.

### Ricerca Quiz
- **Icona play per dettaglio quiz:** `createDetailButton` in `ui.js` ora accetta un tipo icona; le azioni di dettaglio quiz in `search.js` usano il triangolo play al posto della lente.

### Gestione Utenti
- **Annulla edit per singola riga:** `users-crud.js` separa la costruzione delle azioni riga e ripristina solo la riga in editing con i dati originali, senza ridisegnare tutta la tabella e senza chiudere eventuali altre righe in modifica.
