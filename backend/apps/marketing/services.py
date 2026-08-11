"""Serviços de colaboração — campanhas de marketing."""


def usuario_display(user) -> str:
    if not user or not getattr(user, 'is_authenticated', False):
        return ''
    return user.name or user.get_full_name() or user.username
