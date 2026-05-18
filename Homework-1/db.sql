CREATE TABLE Utente (
    nomeUtente VARCHAR(255) PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    cognome VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL
);

CREATE TABLE Quiz (
    codice INT PRIMARY KEY AUTO_INCREMENT,
    creatore VARCHAR(255) FOREIGN KEY REFERENCES Utente(nomeUtente),
    titolo varchar(255) NOT NULL,
    dataInizio DATE NOT NULL,
    dataFine DATE NOT NULL
);

CREATE TABLE Domanda (
    quiz INT FOREIGN KEY REFERENCES Quiz(codice),
    numero INT NOT NULL,
    testo VARCHAR(255) NOT NULL,
    PRIMARY KEY (quiz, numero)
);

CREATE TABLE Risposta (
    quiz INT FOREIGN KEY REFERENCES Quiz(codice),
    domanda INT FOREIGN KEY REFERENCES Domanda(numero),
    numero INT NOT NULL,
    testo VARCHAR(255) NOT NULL,
    tipo VARCHAR(50),
    punteggio INT,
    CONSTRAINT chk_risposta_tipo CHECK ((tipo = 'Corretta' AND punteggio IS NOT NULL) OR (tipo = 'Sbagliata' AND punteggio IS NULL)),
    PRIMARY KEY (quiz, domanda, numero)
);

CREATE TABLE Partecipazione (
    codice INT PRIMARY KEY AUTO_INCREMENT,
    utente VARCHAR(255) FOREIGN KEY REFERENCES Utente(nomeUtente),
    quiz INT FOREIGN KEY REFERENCES Quiz(codice),
    data DATE NOT NULL,
);

CREATE TABLE RispostaUtenteQuiz (
    partecipazione INT FOREIGN KEY REFERENCES Partecipazione(codice),
    quiz INT FOREIGN KEY REFERENCES Quiz(codice),
    domanda INT FOREIGN KEY REFERENCES Domanda(numero),
    risposta INT FOREIGN KEY REFERENCES Risposta(numero),
    PRIMARY KEY (partecipazione, domanda, quiz, risposta)
);