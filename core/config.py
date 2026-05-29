import json
from typing import Any, List, Optional
from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    """
    Application settings loaded from environment variables and validated strictly.
    Uses Pydantic Settings and strict type hints.
    """
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

    # Gemini API Key Pool validation (exactly 5 keys)
    GEMINI_API_KEY_POOL: List[SecretStr] = Field(
        ...,
        description="Indexed pool of exactly 5 API keys for Gemini."
    )

    # Gemini API Key individual (optional, e.g. visual analysis)
    GEMINI_API_KEY: Optional[SecretStr] = Field(
        default=None,
        description="Optional single API key for Gemini visual analysis."
    )

    # SRI Direct Query Proxy Configuration
    SRI_PROXY_URL: str = Field(
        ...,
        description="Base URL for the direct query proxy of SRI."
    )
    SRI_PROXY_USER: str = Field(
        ...,
        description="Username for authentication against the SRI proxy."
    )
    SRI_PROXY_PASSWORD: SecretStr = Field(
        ...,
        description="Password for authentication against the SRI proxy."
    )

    # Master bypass switch for Gemini Cognitive features
    BYPASS_GEMINI: bool = Field(
        default=False,
        description="Master bypass switch to disable Gemini calls completely and run local contingency algorithms."
    )

    # Redis Connection Configuration
    REDIS_HOST: str = Field(
        default="127.0.0.1",
        description="Redis server host. Defaults to localhost loopback for security."
    )
    REDIS_PORT: int = Field(
        default=6379,
        description="Redis server port."
    )
    REDIS_DB: int = Field(
        default=0,
        description="Redis database index."
    )

    @field_validator("GEMINI_API_KEY_POOL", mode="before")
    @classmethod
    def parse_gemini_pool(cls, v: Any) -> Any:
        """
        Parses GEMINI_API_KEY_POOL from environment string if it is a comma-separated or JSON list.
        """
        if isinstance(v, str):
            val = v.strip()
            # Try to parse as JSON list first
            if val.startswith("[") and val.endswith("]"):
                try:
                    parsed = json.loads(val)
                    if isinstance(parsed, list):
                        return parsed
                except json.JSONDecodeError:
                    pass
            # Fallback to comma-separated list
            return [k.strip() for k in val.split(",") if k.strip()]
        return v

    @field_validator("GEMINI_API_KEY_POOL", mode="after")
    @classmethod
    def validate_gemini_pool(cls, v: List[SecretStr]) -> List[SecretStr]:
        """
        Ensures the pool of API keys contains exactly 5 elements.
        """
        if len(v) != 5:
            raise ValueError(
                f"GEMINI_API_KEY_POOL must contain exactly 5 API keys, but got {len(v)}."
            )
        return v

    def get_gemini_key(self, index: int) -> str:
        """
        Returns the Gemini API key at the specified index as a plain string.
        
        Args:
            index: An integer from 0 to 4.
            
        Returns:
            The raw API key string.
        """
        if not (0 <= index < 5):
            raise IndexError("Gemini API key pool index must be between 0 and 4 inclusive.")
        return self.GEMINI_API_KEY_POOL[index].get_secret_value()

# Instancia global única del modelo de configuración
settings = Settings()

