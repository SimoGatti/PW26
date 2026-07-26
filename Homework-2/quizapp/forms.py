from django import forms


class UserForm(forms.Form):
    nomeUtente = forms.CharField(max_length=100, label="Username")
    nome = forms.CharField(max_length=100)
    cognome = forms.CharField(max_length=100)
    email = forms.EmailField(max_length=254)

    def __init__(self, *args, editing=False, **kwargs):
        super().__init__(*args, **kwargs)
        if editing:
            self.fields.pop("nomeUtente")


class ParticipantForm(forms.Form):
    username = forms.CharField(max_length=100, label="Utente")
