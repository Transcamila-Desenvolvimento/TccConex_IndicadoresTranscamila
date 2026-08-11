from django.db import migrations


def backfill_publicar_posts_funcao(apps, schema_editor):
    CustomUser = apps.get_model('accounts', 'CustomUser')
    for user in CustomUser.objects.filter(role_id='1'):
        funcoes = dict(user.funcoes or {})
        marketing = list(funcoes.get('Marketing') or [])
        if 'publicar-posts' not in marketing:
            marketing.append('publicar-posts')
            funcoes['Marketing'] = marketing
            user.funcoes = funcoes
            user.save()


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0016_backfill_marketing_funcoes'),
    ]

    operations = [
        migrations.RunPython(backfill_publicar_posts_funcao, migrations.RunPython.noop),
    ]
