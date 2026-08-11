from django.core.management.base import BaseCommand

from apps.marketing.instagram_publish import publish_due_scheduled_posts


class Command(BaseCommand):
    help = 'Publica postagens Instagram programadas cujo horário já passou'

    def handle(self, *args, **options):
        count = publish_due_scheduled_posts()
        self.stdout.write(self.style.SUCCESS(f'Publicadas {count} postagem(ns) programada(s).'))
