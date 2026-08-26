from django.db import migrations


def backfill_gerenciar_escopos_admin(apps, schema_editor):
    CustomUser = apps.get_model('accounts', 'CustomUser')
    for user in CustomUser.objects.filter(role_id='1'):
        funcoes = dict(user.funcoes or {})
        sgq = list(funcoes.get('SGQ') or [])
        if 'gerenciar-escopos' not in sgq:
            sgq.append('gerenciar-escopos')
            funcoes['SGQ'] = sgq
            user.funcoes = funcoes
            user.save(update_fields=['funcoes'])


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0021_add_logistica_permission'),
    ]

    operations = [
        migrations.RunPython(backfill_gerenciar_escopos_admin, migrations.RunPython.noop),
    ]
