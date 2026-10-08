from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('financeiro', '0009_caixinha_lancamento'),
    ]

    operations = [
        migrations.CreateModel(
            name='CaixinhaDescricao',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('movement_type', models.CharField(max_length=20)),
                ('description', models.CharField(max_length=300)),
                ('created_by', models.CharField(blank=True, default='', max_length=100)),
            ],
            options={
                'ordering': ['movement_type', 'description', 'id'],
            },
        ),
        migrations.AddConstraint(
            model_name='caixinhadescricao',
            constraint=models.UniqueConstraint(fields=('movement_type', 'description'), name='uniq_caixinha_descricao_tipo'),
        ),
    ]
