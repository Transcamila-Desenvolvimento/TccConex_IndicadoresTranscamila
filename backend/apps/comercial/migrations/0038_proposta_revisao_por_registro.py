from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('comercial', '0037_parametros_comercial'),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name='propostacomercial',
            name='comercial_proposta_numero_ano_uniq',
        ),
        migrations.AddConstraint(
            model_name='propostacomercial',
            constraint=models.UniqueConstraint(
                condition=models.Q(('ano__isnull', False), ('numero__isnull', False)),
                fields=('ano', 'numero', 'revisao'),
                name='comercial_proposta_numero_ano_revisao_uniq',
            ),
        ),
    ]
