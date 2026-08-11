from django.db import migrations


def backfill_importar_pesquisas_admin(apps, schema_editor):
    CustomUser = apps.get_model('accounts', 'CustomUser')
    for user in CustomUser.objects.filter(role_id='1'):
        funcoes = dict(user.funcoes or {})
        sgq = list(funcoes.get('SGQ') or [])
        if 'importar-pesquisas' not in sgq:
            sgq.append('importar-pesquisas')
            funcoes['SGQ'] = sgq
            user.funcoes = funcoes
            user.save()


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0017_backfill_publicar_posts_funcao'),
    ]

    operations = [
        migrations.RunPython(backfill_importar_pesquisas_admin, migrations.RunPython.noop),
    ]
