# QUIZZING 2 - Scelte di progetto

QUIZZING 2 adotta il Caso A delle linee guida: ristrutturazione completa del
primo progetto con Python 3.12, Django, PostgreSQL e Bootstrap locale.
L'applicazione precedente era una SPA con backend PHP e database MySQL. La
nuova versione usa pagine server-side e URL Django, senza dipendere da
Altervista, CDN o rendering principale tramite JavaScript.

L'architettura separa quattro responsabilità. Le view coordinano richiesta e
risposta. I Django Form validano i dati inseriti. I repository contengono tutto
l'SQL applicativo parametrizzato. I service racchiudono le operazioni
transazionali. Questa divisione rende visibili le query richieste dal progetto
e impedisce di mescolare regole di dominio, HTML e accesso al database.

PostgreSQL conserva lo schema logico del dominio Quiz. Le chiavi esterne usano
`ON DELETE RESTRICT`; la cancellazione utente non sfrutta cascade implicite.
Prima dell'eliminazione l'applicazione conta le dipendenze. Un quiz con
partecipazioni blocca l'operazione. Negli altri casi un service elimina in
ordine risposte, partecipazioni, domande, quiz e utente dentro una transazione.

Lo svolgimento di un quiz usa una bozza nella sessione Django. La bozza
contiene utente, quiz, ordine casuale delle risposte, selezioni e token
monouso. Nessun record applicativo viene creato all'avvio. Partecipazione e
risposte vengono inserite insieme soltanto dopo la validazione finale. Un
abbandono elimina la bozza senza lasciare record incompleti.

Le ricerche usano la query string come unica fonte dello stato. Filtri,
ordinamento, dimensione e pagina sono riproducibili copiando l'URL. Count e
query dati condividono le stesse condizioni. La paginazione avviene nel
database; JavaScript aggiunge soltanto l'aggiornamento progressivo con debounce
e mantiene disponibile il percorso GET senza JavaScript.

L'interfaccia usa una shell responsive, tabelle con colonne stabili, cifre
tabulari e scorrimento interno. Le icone e Bootstrap sono inclusi localmente.
Radio button e checkbox dipendono dal numero di risposte corrette calcolato sul
server. Il dataset include casi singoli e multipli, tutti gli stati dei quiz e
10.000 partecipazioni per esercitare filtri e paginazione con volumi realistici.

L'installazione usa un unico comando per macOS/Linux, PowerShell o CMD. Il
bootstrap crea l'ambiente virtuale, completa la configurazione, verifica
PostgreSQL e propone soltanto operazioni additive. Schema e dati esistenti non
vengono cancellati o sovrascritti.
