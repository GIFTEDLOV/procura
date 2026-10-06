from genlayer_py.abi import calldata
from genlayer_py.contracts.utils import make_calldata_object


NUMERIC_HASHES = (
    "1234567890123456789012345678901234567890123456789012345678901234",
    "0000000000000000000000000000000000000000000000000000000000000000",
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
)


def test_numeric_hash_strings_remain_strings_in_sdk_calldata():
    for hash_value in NUMERIC_HASHES:
        assert isinstance(hash_value, str)
        encoded = calldata.encode(
            make_calldata_object(
                method="create_tender",
                kwargs={"tender_hash": hash_value},
            )
        )
        decoded = calldata.decode(encoded)
        assert decoded["kwargs"]["tender_hash"] == hash_value
        assert isinstance(decoded["kwargs"]["tender_hash"], str)
