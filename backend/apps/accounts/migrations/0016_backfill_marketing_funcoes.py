from django.db import migrations


def backfill_marketing_funcoes(apps, schema_editor):
    CustomUser = apps.get_model('accounts', 'CustomUser')
    all_keys = ['criar-posts', 'editar-posts', 'excluir-posts']

    for user in CustomUser.objects.filter(role_id='1'):
        funcoes = dict(user.funcoes or {})
        if funcoes.get('Marketing') != all_keys:
            funcoes['Marketing'] = list(all_keys)
            user.funcoes = funcoes
            user.save()


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0015_add_marketing_permission'),
    ]

    operations = [
        migrations.RunPython(backfill_marketing_funcoes, migrations.RunPython.noop),
    ]
