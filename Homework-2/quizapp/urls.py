from django.urls import path
from . import views
urlpatterns=[
 path("",views.home,name="home"),path("users/",views.user_list,name="user-list"),path("users/new/",views.user_new,name="user-new"),path("users/suggestions/",views.user_suggestions,name="user-suggestions"),path("users/<str:username>/",views.user_detail,name="user-detail"),path("users/<str:username>/edit/",views.user_edit,name="user-edit"),path("users/<str:username>/delete/",views.user_delete,name="user-delete"),
 path("quizzes/",views.quiz_list,name="quiz-list"),path("quizzes/<int:code>/",views.quiz_detail,name="quiz-detail"),path("quizzes/<int:code>/participate/",views.participate,name="participate"),
 path("participations/",views.participation_list,name="participation-list"),path("participations/<int:code>/",views.participation_detail,name="participation-detail"),path("attempt/",views.attempt,name="attempt"),path("attempt/abandon/confirm/",views.abandon_confirm,name="abandon-confirm"),path("attempt/abandon/",views.abandon,name="abandon")]
