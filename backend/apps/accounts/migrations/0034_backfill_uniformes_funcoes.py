from django.db import migrations

FUNCOES_UNIFORMES = [
    'cadastrar-uniformes',
    'editar-uniformes',
    'movimentar-uniformes',
    'entregar-uniformes',
    'devolver-uniformes',
    'exportar-uniformes',
]


def backfill_uniformes(apps, schema_editor):
    """Quem já acessa Compras mantém as ações que antes eram livres."""
    CustomUser = apps.get_model('accounts', 'CustomUser')
    for user in CustomUser.objects.exclude(role_id='1'):
        if 'Compras' not in (user.environments or []):
            continue
        funcoes = dict(user.funcoes or {})
        compras = list(funcoes.get('Compras') or [])
        alterou = False
        for chave in FUNCOES_UNIFORMES:
            if chave not in compras:
                compras.append(chave)
                alterou = True
        if not alterou:
            continue
        funcoes['Compras'] = compras
        user.funcoes = funcoes
        user.save(update_fields=['funcoes'])


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0033_customuser_indicador_filiais'),
    ]

    operations = [
        migrations.RunPython(backfill_uniformes, migrations.RunPython.noop),
    ]
