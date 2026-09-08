from backend.main import match_scheme, load_schemes, UserProfile

def test_full_match():
    p=UserProfile(name="Ravi",state="Tamil Nadu",category="SC",age=28,
        annual_income=200000,business_type="Food",business_stage="Existing",
        loan_amount=500000,rural=True)
    r=match_scheme(p,load_schemes()[0])
    assert r["match_percentage"] == 100
    assert r["eligible"] is True
