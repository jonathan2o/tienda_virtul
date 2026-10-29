from django.urls import path

from .views import LoginView, UsuariosListaView

urlpatterns = [
    path('auth/login/', LoginView.as_view(), name='login'),
    path('usuarios/', UsuariosListaView.as_view(), name='usuarios-lista'),
]
