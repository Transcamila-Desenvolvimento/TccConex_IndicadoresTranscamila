from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('marketing', '0005_alter_instagrampost_post_format_instagrampostslide'),
    ]

    operations = [
        migrations.DeleteModel(
            name='InstagramPostSlide',
        ),
        migrations.DeleteModel(
            name='InstagramPost',
        ),
        migrations.DeleteModel(
            name='InstagramConnection',
        ),
        migrations.CreateModel(
            name='CampanhaMarketing',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('titulo', models.CharField(max_length=200, verbose_name='Título')),
                ('descricao', models.TextField(blank=True, default='', verbose_name='Descrição')),
                ('data_inicio', models.DateField(verbose_name='Data início')),
                ('data_fim', models.DateField(verbose_name='Data fim')),
                ('status', models.CharField(
                    choices=[
                        ('planejamento', 'Planejamento'),
                        ('producao', 'Em produção'),
                        ('veiculacao', 'Em veiculação'),
                        ('concluida', 'Concluída'),
                        ('cancelada', 'Cancelada'),
                    ],
                    default='planejamento',
                    max_length=20,
                    verbose_name='Status',
                )),
                ('canal', models.CharField(
                    choices=[
                        ('multicanal', 'Multicanal'),
                        ('redes_sociais', 'Redes sociais'),
                        ('email', 'E-mail marketing'),
                        ('evento', 'Evento'),
                        ('midia', 'Mídia offline'),
                        ('outro', 'Outro'),
                    ],
                    default='multicanal',
                    max_length=30,
                    verbose_name='Canal',
                )),
                ('responsavel', models.CharField(blank=True, default='', max_length=150, verbose_name='Responsável')),
                ('cor', models.CharField(default='azul', max_length=20, verbose_name='Cor no calendário')),
                ('ordem_kanban', models.PositiveIntegerField(default=0, verbose_name='Ordem no kanban')),
                ('criado_por', models.CharField(blank=True, default='', max_length=150, verbose_name='Criado por')),
                ('data_criacao', models.DateTimeField(auto_now_add=True)),
                ('data_atualizacao', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Campanha de marketing',
                'verbose_name_plural': 'Campanhas de marketing',
                'ordering': ['ordem_kanban', '-data_inicio', '-data_criacao'],
            },
        ),
    ]
