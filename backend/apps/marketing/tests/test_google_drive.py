from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.marketing.google_drive import (
    HOME_FOLDER_ID,
    SHARED_WITH_ME_ID,
    browse_drive_folder,
)

User = get_user_model()


class DriveBrowseLogicTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='mkt-drive-browse',
            password='test123',
            name='Marketing Drive Browse',
            role_id='1',
            google_token={
                'token': 'fake-token',
                'scopes': ['https://www.googleapis.com/auth/drive.readonly'],
            },
        )

    @patch('apps.marketing.google_drive.get_drive_access_token', return_value='fake-token')
    @patch('apps.marketing.google_drive._list_shared_drives')
    def test_browse_home_inclui_meu_drive_compartilhados_e_drives(self, mock_list_drives, _mock_token):
        mock_list_drives.return_value = {
            'drives': [{'id': 'team-1', 'name': 'Marketing Equipe'}],
            'nextPageToken': None,
        }

        payload = browse_drive_folder(self.user, folder_id=HOME_FOLDER_ID)

        self.assertEqual(payload['folderId'], HOME_FOLDER_ID)
        names = [item['name'] for item in payload['items']]
        self.assertEqual(names[:2], ['Meu Drive', 'Compartilhados comigo'])
        self.assertIn('Marketing Equipe', names)

    @patch('apps.marketing.google_drive.get_drive_access_token', return_value='fake-token')
    @patch('apps.marketing.google_drive._list_drive_files')
    def test_browse_shared_with_me_usa_filtro_correto(self, mock_list_files, _mock_token):
        mock_list_files.return_value = {'files': [], 'nextPageToken': None}

        browse_drive_folder(self.user, folder_id=SHARED_WITH_ME_ID)

        query = mock_list_files.call_args.kwargs['query']
        self.assertIn('sharedWithMe = true', query)

    @patch('apps.marketing.google_drive.get_drive_access_token', return_value='fake-token')
    @patch('apps.marketing.google_drive._list_drive_files')
    def test_browse_drive_compartilhado_envia_corpora(self, mock_list_files, _mock_token):
        mock_list_files.return_value = {'files': [], 'nextPageToken': None}

        browse_drive_folder(self.user, folder_id='drive:team-1')

        self.assertEqual(mock_list_files.call_args.kwargs['drive_id'], 'team-1')


class DriveStatusTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='mkt-drive',
            password='test123',
            name='Marketing Drive',
            role_id='1',
        )
        self.client.force_authenticate(self.user)

    def test_drive_status_sem_google_vinculado(self):
        response = self.client.get('/api/marketing/drive/status/')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['needsGoogleLink'])

    def test_browse_sem_google_retorna_400(self):
        response = self.client.get('/api/marketing/drive/browse/')
        self.assertEqual(response.status_code, 400)
