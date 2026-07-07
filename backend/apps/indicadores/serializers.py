from rest_framework import serializers

from .models import IndicadorFilial, IndicadorKpi


class IndicadorKpiSerializer(serializers.ModelSerializer):
    class Meta:
        model = IndicadorKpi
        fields = ['label', 'value', 'change', 'up']


class IndicadorFilialSerializer(serializers.ModelSerializer):
    class Meta:
        model = IndicadorFilial
        fields = ['filial', 'receita', 'fretes', 'toneladas', 'meta']
