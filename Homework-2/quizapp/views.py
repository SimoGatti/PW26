"""View server-side per navigazione, ricerche, CRUD e svolgimento quiz."""

from math import ceil

from django.contrib import messages
from django.db import IntegrityError
from django.http import Http404, HttpResponseNotAllowed, JsonResponse
from django.shortcuts import redirect, render
from django.urls import reverse

from .forms import ParticipantForm, UserForm
from .repositories import participations, quizzes, users
from .repositories.common import list_state
from .services import answer_order, quiz_attempt, user_deletion


def listing(request, kind):
    """Costruisce una lista paginata usando la query string come unico stato."""
    configurations = {
        "users": (
            users.search,
            {"username", "nome", "cognome", "created", "participations"},
            "username",
        ),
        "quizzes": (
            quizzes.search,
            {
                "code",
                "title",
                "creator",
                "status",
                "start",
                "end",
                "questions",
                "participations",
            },
            "title",
        ),
        "participations": (
            participations.search,
            {"code", "username", "quiz", "date", "answers", "score"},
            "score",
        ),
    }
    search, allowed_sorts, default_sort = configurations[kind]
    state = list_state(request, allowed_sorts, default_sort)
    filters = {
        key: value
        for key, value in request.GET.items()
        if key not in {"page", "size", "sort", "dir", "mode"}
    }
    if kind == "quizzes" and "status" not in request.GET:
        filters["status"] = "open"

    view_mode = request.GET.get("mode", "compact")
    if view_mode not in {"compact", "extended"}:
        view_mode = "compact"

    result, total = search(filters, state)
    pages = max(1, ceil(total / state.size))
    page = min(state.page, pages)
    if page != state.page:
        state = state.__class__(
            page,
            state.size,
            state.sort,
            state.direction,
            state.params,
        )
        result, total = search(filters, state)

    sort_urls = {}
    for sort_key in allowed_sorts:
        is_ascending = state.sort == sort_key and state.direction == "asc"
        sort_urls[sort_key] = state.query(
            sort=sort_key,
            dir="desc" if is_ascending else "asc",
            page=1,
        )

    bounds_provider = {
        "users": users.bounds,
        "quizzes": quizzes.bounds,
        "participations": participations.bounds,
    }[kind]
    context = {
        "items": result,
        "total": total,
        "state": state,
        "pages": pages,
        "filters": filters,
        "bounds": bounds_provider(),
        "kind": kind,
        "view_mode": view_mode,
        "compact_query": state.query(mode="compact", page=1),
        "extended_query": state.query(mode="extended", page=1),
        "sort_urls": sort_urls,
    }
    return render(request, f"{kind}/list.html", context)


def home(request):
    """Mostra la pagina iniziale con i conteggi generali."""
    return render(request, "home.html", {"stats": users.stats()})


def user_list(request):
    """Mostra la ricerca paginata degli utenti."""
    return listing(request, "users")


def quiz_list(request):
    """Mostra la ricerca paginata dei quiz."""
    return listing(request, "quizzes")


def participation_list(request):
    """Mostra la ricerca paginata delle partecipazioni."""
    return listing(request, "participations")


def user_suggestions(request):
    """Restituisce al massimo dodici utenti per il completamento progressivo."""
    query = request.GET.get("q", "").strip()
    if len(query) < 2:
        return JsonResponse({"items": []})
    return JsonResponse({"items": users.username_suggestions(query)})


def user_detail(request, username):
    """Mostra il profilo e le relazioni dell'utente richiesto."""
    user = users.detail(username)
    if not user:
        raise Http404
    return render(request, "users/detail.html", {"user": user})


def user_new(request):
    """Crea un utente dopo la validazione del form condiviso."""
    form = UserForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        try:
            users.create(form.cleaned_data)
            messages.success(request, "Utente creato.")
            return redirect(
                "user-detail",
                username=form.cleaned_data["nomeUtente"],
            )
        except IntegrityError:
            form.add_error("nomeUtente", "Username già esistente.")
    return render(
        request,
        "users/form.html",
        {"form": form, "editing": False},
    )


def user_edit(request, username):
    """Aggiorna i dati modificabili senza cambiare lo username."""
    user = users.get(username)
    if not user:
        raise Http404
    initial = {
        "nome": user["nome"],
        "cognome": user["cognome"],
        "email": user["email"],
    }
    form = UserForm(request.POST or None, initial=initial, editing=True)
    if request.method == "POST" and form.is_valid():
        users.update(username, form.cleaned_data)
        messages.success(request, "Utente aggiornato.")
        return redirect("user-detail", username=username)
    return render(
        request,
        "users/form.html",
        {"form": form, "editing": True, "username": username},
    )


def user_delete(request, username):
    """Mostra le dipendenze su GET ed elimina soltanto dopo un POST valido."""
    if not users.get(username):
        raise Http404
    preview = users.deletion_preview(username)
    if request.method == "POST":
        if not preview["allowed"]:
            messages.error(
                request,
                "Cancellazione bloccata: esistono partecipazioni ai quiz creati.",
            )
        else:
            user_deletion.delete_user(username)
            messages.success(request, "Utente eliminato.")
            return redirect("user-list")
    return render(
        request,
        "users/delete.html",
        {"username": username, "preview": preview},
    )


def quiz_detail(request, code):
    """Mostra il quiz informativo con risposte in ordine casuale."""
    quiz = quizzes.detail(code)
    if not quiz:
        raise Http404
    answer_order.randomize_question_answers(quiz["question_list"])
    context = {
        "quiz": quiz,
        "solutions_visible": request.GET.get("solutions") == "1",
    }
    return render(request, "quizzes/detail.html", context)


def participation_detail(request, code):
    """Mostra risultato e soluzioni senza legare il significato alla posizione."""
    participation = participations.detail(code)
    if not participation:
        raise Http404
    answer_order.randomize_question_answers(participation["questions"])
    context = {
        "participation": participation,
        "solutions_visible": request.GET.get("review") == "1",
    }
    return render(request, "participations/detail.html", context)


def participate(request, code):
    """Sceglie l'utente e crea soltanto una bozza nella sessione Django."""
    quiz = quizzes.attempt_data(code)
    if not quiz:
        messages.error(request, "Il quiz non è aperto.")
        return redirect("quiz-detail", code=code)

    form = ParticipantForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        username = form.cleaned_data["username"]
        if not users.get(username):
            form.add_error("username", "Utente inesistente.")
        else:
            quiz_attempt.start(request.session, quiz, username)
            return redirect("attempt")
    return render(
        request,
        "attempt/participant.html",
        {"form": form, "quiz": quiz},
    )


def attempt(request):
    """Mostra la bozza e persiste il tentativo soltanto all'invio conclusivo."""
    data = request.session.get(quiz_attempt.SESSION_KEY)
    if not data:
        return redirect("quiz-list")

    quiz = quizzes.attempt_data(data["quiz_code"])
    if not quiz:
        request.session.pop(quiz_attempt.SESSION_KEY, None)
        messages.error(request, "Il quiz non è più aperto.")
        return redirect("quiz-list")

    if request.method == "POST":
        quiz_attempt.save_choices(request.session, request.POST)
        try:
            code = quiz_attempt.validate_and_submit(
                request.session,
                request.POST.get("attempt_token", ""),
            )
            detail_url = reverse(
                "participation-detail",
                kwargs={"code": code},
            )
            return redirect(f"{detail_url}?review=1")
        except ValueError as error:
            messages.error(request, str(error))

    selected = data.get("selected", {})
    for question in quiz["question_list"]:
        question["multiple"] = (
            sum(answer["tipo"] == "Corretta" for answer in question["answers"])
            > 1
        )
        order = data["order"].get(str(question["number"]), [])
        question["answers"].sort(
            key=lambda answer: order.index(answer["answer_number"])
        )
        question["selected"] = selected.get(str(question["number"]), [])
    return render(
        request,
        "attempt/play.html",
        {"quiz": quiz, "attempt": data},
    )


def abandon_confirm(request):
    """Fornisce la conferma server-side usata quando JavaScript è disattivato."""
    if request.method != "GET":
        return HttpResponseNotAllowed(["GET"])
    data = request.session.get(quiz_attempt.SESSION_KEY)
    if not data:
        return redirect("quiz-list")
    quiz = quizzes.detail(data["quiz_code"])
    return render(
        request,
        "attempt/abandon_confirm.html",
        {"attempt": data, "quiz": quiz},
    )


def abandon(request):
    """Elimina la sola bozza di sessione; non esistono record parziali."""
    if request.method != "POST":
        return HttpResponseNotAllowed(["POST"])
    request.session.pop(quiz_attempt.SESSION_KEY, None)
    messages.info(request, "Bozza abbandonata.")
    return redirect("quiz-list")
