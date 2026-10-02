-- Lo que Drizzle no genera: extensiones, restricción de exclusión y búsqueda.
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS unaccent;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint

-- Sin solapamientos por profesional entre reservas activas. Es la última defensa:
-- si dos personas reservan el mismo hueco a la vez, la segunda inserción falla (23P01).
-- btree_gist permite mezclar "=" sobre uuid con "&&" sobre rangos en el mismo índice GiST.
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_overlap"
  EXCLUDE USING gist ("staff_id" WITH =, tstzrange("starts_at", "ends_at") WITH &&)
  WHERE ("status" IN ('pending', 'confirmed'));--> statement-breakpoint

-- unaccent() no es IMMUTABLE y Postgres no deja usarla en índices; este envoltorio sí.
CREATE FUNCTION f_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;--> statement-breakpoint

-- search_vector: nombre (peso A), categoría y ciudad (B) y descripción (C), sin tildes.
CREATE FUNCTION businesses_search_vector_update() RETURNS trigger
  LANGUAGE plpgsql AS $$
DECLARE
  category_name text;
BEGIN
  SELECT name INTO category_name FROM categories WHERE id = NEW.category_id;
  NEW.search_vector :=
    setweight(to_tsvector('spanish', f_unaccent(coalesce(NEW.name, ''))), 'A') ||
    setweight(to_tsvector('spanish', f_unaccent(coalesce(category_name, ''))), 'B') ||
    setweight(to_tsvector('spanish', f_unaccent(coalesce(NEW.city, ''))), 'B') ||
    setweight(to_tsvector('spanish', f_unaccent(coalesce(NEW.description, ''))), 'C');
  RETURN NEW;
END $$;--> statement-breakpoint

CREATE TRIGGER businesses_search_vector_trigger
  BEFORE INSERT OR UPDATE OF name, description, city, category_id ON businesses
  FOR EACH ROW EXECUTE FUNCTION businesses_search_vector_update();--> statement-breakpoint

CREATE INDEX "businesses_search_vector_idx" ON "businesses" USING gin ("search_vector");--> statement-breakpoint

-- Trigramas (pg_trgm) para tolerar erratas en nombre y ciudad, y filtrar ciudad normalizada.
CREATE INDEX "businesses_name_trgm_idx" ON "businesses" USING gin (f_unaccent(lower("name")) gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "businesses_city_trgm_idx" ON "businesses" USING gin (f_unaccent(lower("city")) gin_trgm_ops);
