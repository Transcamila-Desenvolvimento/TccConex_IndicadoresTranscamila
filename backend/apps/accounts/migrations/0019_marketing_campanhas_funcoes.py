from django.db import migrations

OLD_TO_NEW = {
    'criar-posts': 'criar-campanhas',
    'editar-posts': 'editar-campanhas',
    'excluir-posts': 'excluir-campanhas',
}

NEW_KEYS = ['criar-campanhas', 'editar-campanhas', 'excluir-campanhas']


def migrate_marketing_funcoes(apps, schema_editor):
    CustomUser = apps.get_model('accounts', 'CustomUser')
    for user in CustomUser.objects.all():
        funcoes = dict(user.funcoes or {})
        marketing = list(funcoes.get('Marketing') or [])
        if not marketing:
            continue
        updated = []
        seen = set()
        for key in marketing:
            mapped = OLD_TO_NEW.get(key, key)
            if mapped in ('publicar-posts',):
                continue
            if mapped not in seen:
                updated.append(mapped)
                seen.add(mapped)
        funcoes['Marketing'] = updated
        user.funcoes = funcoes
        user.save(update_fields=['funcoes'])

    for user in CustomUser.objects.filter(role_id='1'):
        funcoes = dict(user.funcoes or {})
        marketing = list(funcoes.get('Marketing') or [])
        for key in NEW_KEYS:
            if key not in marketing:
                marketing.append(key)
        funcoes['Marketing'] = marketing
        user.funcoes = funcoes
        user.save(update_fields=['funcoes'])


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0018_add_importar_pesquisas_funcao'),
    ]

    operations = [
        migrations.RunPython(migrate_marketing_funcoes, migrations.RunPython.noop),
    ]
