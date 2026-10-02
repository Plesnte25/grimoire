import ad from "flag-icons/flags/4x3/ad.svg?url";
import at from "flag-icons/flags/4x3/at.svg?url";
import au from "flag-icons/flags/4x3/au.svg?url";
import be from "flag-icons/flags/4x3/be.svg?url";
import br from "flag-icons/flags/4x3/br.svg?url";
import ca from "flag-icons/flags/4x3/ca.svg?url";
import cn from "flag-icons/flags/4x3/cn.svg?url";
import cz from "flag-icons/flags/4x3/cz.svg?url";
import de from "flag-icons/flags/4x3/de.svg?url";
import dk from "flag-icons/flags/4x3/dk.svg?url";
import es from "flag-icons/flags/4x3/es.svg?url";
import fi from "flag-icons/flags/4x3/fi.svg?url";
import fr from "flag-icons/flags/4x3/fr.svg?url";
import gb from "flag-icons/flags/4x3/gb.svg?url";
import gr from "flag-icons/flags/4x3/gr.svg?url";
import hk from "flag-icons/flags/4x3/hk.svg?url";
import hu from "flag-icons/flags/4x3/hu.svg?url";
import id from "flag-icons/flags/4x3/id.svg?url";
import ie from "flag-icons/flags/4x3/ie.svg?url";
import inFlag from "flag-icons/flags/4x3/in.svg?url";
import it from "flag-icons/flags/4x3/it.svg?url";
import jp from "flag-icons/flags/4x3/jp.svg?url";
import kr from "flag-icons/flags/4x3/kr.svg?url";
import mx from "flag-icons/flags/4x3/mx.svg?url";
import nl from "flag-icons/flags/4x3/nl.svg?url";
import no from "flag-icons/flags/4x3/no.svg?url";
import nz from "flag-icons/flags/4x3/nz.svg?url";
import ph from "flag-icons/flags/4x3/ph.svg?url";
import pk from "flag-icons/flags/4x3/pk.svg?url";
import pl from "flag-icons/flags/4x3/pl.svg?url";
import pt from "flag-icons/flags/4x3/pt.svg?url";
import ro from "flag-icons/flags/4x3/ro.svg?url";
import ru from "flag-icons/flags/4x3/ru.svg?url";
import sa from "flag-icons/flags/4x3/sa.svg?url";
import se from "flag-icons/flags/4x3/se.svg?url";
import sg from "flag-icons/flags/4x3/sg.svg?url";
import th from "flag-icons/flags/4x3/th.svg?url";
import tr from "flag-icons/flags/4x3/tr.svg?url";
import tw from "flag-icons/flags/4x3/tw.svg?url";
import ua from "flag-icons/flags/4x3/ua.svg?url";
import us from "flag-icons/flags/4x3/us.svg?url";
import vn from "flag-icons/flags/4x3/vn.svg?url";
import { countryFlag } from "../lib/regions";

const FLAG_ASSETS: Record<string, string> = {
  AD: ad, AT: at, AU: au, BE: be, BR: br, CA: ca, CN: cn, CZ: cz, DE: de, DK: dk,
  ES: es, FI: fi, FR: fr, GB: gb, GR: gr, HK: hk, HU: hu, ID: id, IE: ie, IN: inFlag,
  IT: it, JP: jp, KR: kr, MX: mx, NL: nl, NO: no, NZ: nz, PH: ph, PK: pk, PL: pl,
  PT: pt, RO: ro, RU: ru, SA: sa, SE: se, SG: sg, TH: th, TR: tr, TW: tw, UA: ua,
  US: us, VN: vn,
};

export function CountryFlag({
  code,
  className = "",
}: {
  code?: string | null;
  className?: string;
}) {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return null;
  const normalized = code.toUpperCase();
  const asset = FLAG_ASSETS[normalized];
  return asset ? (
    <img
      src={asset}
      className={`inline-block h-3.5 w-[1.2rem] rounded-sm object-cover ${className}`.trim()}
      role="img"
      alt={`${normalized} flag`}
    />
  ) : (
    <span className={className} role="img" aria-label={`${normalized} flag`}>
      {countryFlag(normalized)}
    </span>
  );
}
