import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


@pytest.fixture
def settings(tmp_path) -> Settings:
    # A fresh database per test, and no static files.
    return Settings(db_path=tmp_path / "test.sqlite3", static_dir=tmp_path / "no-client")


@pytest.fixture
def client(settings):
    with TestClient(create_app(settings)) as test_client:
        yield test_client


#: A complete design, as the client would send it. The ids are only checked
#: for shape here: the server does not know the game content.
DESIGN = {
    "orbitId": "sso-500",
    "launcherId": "falcon9-rideshare",
    "structureId": "structure-3u-isispace",
    "solarArrayId": "solar-deployable-3u-endurosat",
    "batteryId": "battery-36wh-orbastro",
    "computerId": "computer-endurosat-obc",
    "attitudeControlId": "adcs-tensortech-mtq",
    "propulsionId": "thruster-enpulsion-nano",
    "radioIds": ["radio-sband-endurosat", "radio-xband-endurosat"],
    "instrumentIds": ["imager-multiscape50"],
    "groundStations": [{"stationId": "station-svalbard", "passesPerDay": 10.5}],
    "imagingMinutesPerDay": 98,
}
