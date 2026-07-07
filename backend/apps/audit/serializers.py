from rest_framework import serializers

from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    userId = serializers.SerializerMethodField()
    timestamp = serializers.DateTimeField(source='created_at', read_only=True)

    class Meta:
        model = AuditLog
        fields = ['id', 'userId', 'username', 'action', 'details', 'timestamp']

    def get_userId(self, obj):
        return str(obj.user_id) if obj.user_id else ''
