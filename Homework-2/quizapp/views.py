from math import ceil
from django.contrib import messages
from django.db import IntegrityError
from django.http import Http404, HttpResponseNotAllowed
from django.shortcuts import redirect, render
from .forms import ParticipantForm, UserForm
from .repositories import quizzes, participations, users
from .repositories.common import list_state
from .services import quiz_attempt, user_deletion

def listing(request, kind):
    config={"users":(users.search,{"username","nome","cognome","created","participations"},"username"),"quizzes":(quizzes.search,{"code","title","creator","status","start","end","questions","participations"},"code"),"participations":(participations.search,{"code","username","quiz","date","answers","score"},"date")}[kind]
    state=list_state(request,config[1],config[2]);filters={k:v for k,v in request.GET.items() if k not in {"page","size","sort","dir","mode"}}
    view_mode=request.GET.get("mode", "compact")
    if view_mode not in {"compact", "extended"}: view_mode="compact"
    result,total=config[0](filters,state); pages=max(1,ceil(total/state.size)); page=min(state.page,pages)
    if page!=state.page: state=state.__class__(page,state.size,state.sort,state.direction,state.params);result,total=config[0](filters,state)
    sort_urls = {}
    for sort_key in config[1]:
        next_direction = "desc" if state.sort == sort_key and state.direction == "asc" else "asc"
        sort_urls[sort_key] = state.query(sort=sort_key, dir=next_direction, page=1)
    return render(request,f"{kind}/list.html",{"items":result,"total":total,"state":state,"pages":pages,"filters":filters,"kind":kind,"view_mode":view_mode,"compact_query":state.query(mode="compact",page=1),"extended_query":state.query(mode="extended",page=1),"sort_urls":sort_urls})

def home(request): return render(request,"home.html",{"stats":users.stats()})
def user_list(request): return listing(request,"users")
def quiz_list(request): return listing(request,"quizzes")
def participation_list(request): return listing(request,"participations")

def user_detail(request,username):
    user=users.detail(username)
    if not user: raise Http404
    return render(request,"users/detail.html",{"user":user})

def user_new(request):
    form=UserForm(request.POST or None)
    if request.method=="POST" and form.is_valid():
        try: users.create(form.cleaned_data);messages.success(request,"Utente creato.");return redirect("user-detail",username=form.cleaned_data["nomeUtente"])
        except IntegrityError: form.add_error("nomeUtente","Username già esistente.")
    return render(request,"users/form.html",{"form":form,"editing":False})

def user_edit(request,username):
    user=users.get(username)
    if not user: raise Http404
    form=UserForm(request.POST or None, initial={"nome": user["nome"], "cognome": user["cognome"], "email": user["email"]}, editing=True)
    if request.method=="POST" and form.is_valid(): users.update(username,form.cleaned_data);messages.success(request,"Utente aggiornato.");return redirect("user-detail",username=username)
    return render(request,"users/form.html",{"form":form,"editing":True,"username":username})

def user_delete(request,username):
    if not users.get(username):raise Http404
    preview=users.deletion_preview(username)
    if request.method=="POST":
        if not preview["allowed"]:messages.error(request,"Cancellazione bloccata: esistono partecipazioni ai quiz creati.")
        else: user_deletion.delete_user(username);messages.success(request,"Utente eliminato.");return redirect("user-list")
    return render(request,"users/delete.html",{"username":username,"preview":preview})

def quiz_detail(request,code):
    quiz=quizzes.detail(code)
    if not quiz:raise Http404
    return render(request,"quizzes/detail.html",{"quiz":quiz})

def participation_detail(request,code):
    participation=participations.detail(code)
    if not participation:raise Http404
    return render(request,"participations/detail.html",{"participation":participation})

def participate(request,code):
    quiz=quizzes.attempt_data(code)
    if not quiz:messages.error(request,"Il quiz non è aperto.");return redirect("quiz-detail",code=code)
    form=ParticipantForm(request.POST or None)
    if request.method=="POST" and form.is_valid():
        if not users.get(form.cleaned_data["username"]):form.add_error("username","Utente inesistente.")
        else: quiz_attempt.start(request.session,quiz,form.cleaned_data["username"]);return redirect("attempt")
    return render(request,"attempt/participant.html",{"form":form,"quiz":quiz})

def attempt(request):
    data=request.session.get(quiz_attempt.SESSION_KEY)
    if not data:return redirect("quiz-list")
    quiz=quizzes.attempt_data(data["quiz_code"])
    if not quiz:request.session.pop(quiz_attempt.SESSION_KEY,None);messages.error(request,"Il quiz non è più aperto.");return redirect("quiz-list")
    if request.method=="POST":
        quiz_attempt.save_choices(request.session,request.POST)
        try: code=quiz_attempt.validate_and_submit(request.session,request.POST.get("attempt_token", ""));return redirect("participation-detail",code=code)
        except ValueError as error:messages.error(request,str(error))
    selected=data.get("selected",{})
    for question in quiz["question_list"]:
        question["multiple"]=sum(a["tipo"]=="Corretta" for a in question["answers"])>1
        order=data["order"].get(str(question["number"]),[]);question["answers"].sort(key=lambda a:order.index(a["answer_number"]))
        question["selected"]=selected.get(str(question["number"]),[])
    return render(request,"attempt/play.html",{"quiz":quiz,"attempt":data})

def abandon(request):
    if request.method!="POST":return HttpResponseNotAllowed(["POST"])
    request.session.pop(quiz_attempt.SESSION_KEY,None);messages.info(request,"Bozza abbandonata.");return redirect("quiz-list")
