from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str = "postgresql://ddadmin:PASSWORD@data-dictionary-db.postgres.database.azure.com:5432/data_dictionary?sslmode=require"
    github_client_id: str = "Ov23lisJDBtDNukA4X3o"  # your existing OAuth app
    github_client_secret: str = ""  # needed for token exchange
    cors_origins: list[str] = ["http://localhost:5173", "http://YOUR_VM_IP"]

    class Config:
        env_file = ".env"

settings = Settings()