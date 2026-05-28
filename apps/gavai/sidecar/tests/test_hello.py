"""Hello unit test module."""

from sidecar.hello import hello


def test_hello():
    """Test the hello function."""
    assert hello() == "Hello sidecar"
