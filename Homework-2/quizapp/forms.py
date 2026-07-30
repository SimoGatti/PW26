"""Form Django per il CRUD utente e la scelta del partecipante."""

from django import forms


class UserForm(forms.Form):
    """Valida gli stessi dati anagrafici in creazione e modifica."""

    nomeUtente = forms.CharField(
        max_length=100,
        label="Username",
        widget=forms.TextInput(attrs={"class": "form-control"}),
    )
    nome = forms.CharField(
        max_length=100,
        widget=forms.TextInput(attrs={"class": "form-control"}),
    )
    cognome = forms.CharField(
        max_length=100,
        widget=forms.TextInput(attrs={"class": "form-control"}),
    )
    email = forms.EmailField(
        max_length=254,
        widget=forms.EmailInput(attrs={"class": "form-control"}),
    )

    def __init__(self, *args, editing=False, **kwargs):
        """Rimuove lo username in modifica perché la chiave è immutabile."""
        super().__init__(*args, **kwargs)
        if editing:
            self.fields.pop("nomeUtente")


class ParticipantForm(forms.Form):
    """Raccoglie l'identità applicativa scelta per un nuovo tentativo."""

    username = forms.CharField(max_length=100, label="Utente")
