#!/usr/bin/env python3
"""Convertit le tableur « Gestion épargne mensuelle.ods » en données pour l'application.

Usage :
    python3 outils/import-ods.py "Gestion épargne mensuelle.ods" prive/donnees-initiales.json [pseudo1 pseudo2]

Le script ne modifie pas le tableur. Il affiche à la fin un contrôle :
le solde de chaque enveloppe dans le tableur et dans l'application.
Aucune dépendance : uniquement la bibliothèque standard de Python.
"""

import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

# Pseudos par défaut des deux personnes (p1 = colonne C du tableur, p2 = colonne D).
# On peut les donner en fin de commande ; ils restent modifiables dans l'application.
PSEUDOS = ["Personne 1", "Personne 2"]

NS_TABLE = "{urn:oasis:names:tc:opendocument:xmlns:table:1.0}"
NS_OFFICE = "{urn:oasis:names:tc:opendocument:xmlns:office:1.0}"
NS_TEXT = "{urn:oasis:names:tc:opendocument:xmlns:text:1.0}"

MAINTENANT = datetime.now(timezone.utc).isoformat(timespec="seconds")


# --- Lecture du fichier .ods -------------------------------------------------

def lire_cellule(cellule):
    """Renvoie un nombre, une date ISO ou un texte selon le type de la cellule."""
    genre = cellule.get(NS_OFFICE + "value-type")
    if genre in ("float", "currency"):
        return float(cellule.get(NS_OFFICE + "value"))
    if genre == "percentage":
        return float(cellule.get(NS_OFFICE + "value")) * 100
    if genre == "date":
        return cellule.get(NS_OFFICE + "date-value")[:10]
    # Seuls les paragraphes directs : les commentaires (annotations) sont ignorés
    texte = "\n".join("".join(p.itertext()) for p in cellule.findall(NS_TEXT + "p"))
    return texte or None


def lire_feuilles(chemin):
    """Renvoie {nom de feuille: liste de lignes}, chaque ligne étant une liste de valeurs."""
    with zipfile.ZipFile(chemin) as archive:
        racine = ET.fromstring(archive.read("content.xml"))

    feuilles = {}
    for table in racine.iter(NS_TABLE + "table"):
        lignes = []
        for ligne in table.iter(NS_TABLE + "table-row"):
            valeurs = []
            for cellule in ligne:
                repetitions = int(cellule.get(NS_TABLE + "number-columns-repeated", "1"))
                valeurs += [lire_cellule(cellule)] * min(repetitions, 50)
            repetitions = int(ligne.get(NS_TABLE + "number-rows-repeated", "1"))
            lignes += [valeurs] * min(repetitions, 5)
        feuilles[table.get(NS_TABLE + "name")] = lignes
    return feuilles


def cellule(feuille, adresse):
    """Lit une cellule par son adresse, par exemple « B4 »."""
    colonne, ligne = re.match(r"([A-Z]+)(\d+)", adresse).groups()
    c = 0
    for lettre in colonne:
        c = c * 26 + ord(lettre) - 64
    try:
        return feuille[int(ligne) - 1][c - 1]
    except IndexError:
        return None


# --- Conversions -------------------------------------------------------------

def centimes(valeur):
    return round(float(valeur or 0) * 100)


def date_iso(valeur):
    """Accepte « 04-10-2026 », « 04/10/2026 » ou « 2026-10-04 »."""
    valeur = str(valeur).strip()
    if re.match(r"\d{4}-\d{2}-\d{2}", valeur):
        return valeur[:10]
    jour, mois, annee = re.split(r"[-/]", valeur)
    return f"{annee}-{mois}-{jour}"


def mois_iso(valeur):
    """« 01/2027 » devient « 2027-01 »."""
    mois, annee = str(valeur).split("/")
    return f"{annee}-{int(mois):02d}"


def pourcentage(valeur):
    """Accepte 20, « 20 », « 20% » ou « 12,5% » et renvoie un nombre comme 20 ou 12.5."""
    if valeur is None or valeur == "":
        return 0
    if isinstance(valeur, str):
        valeur = float(valeur.replace("%", "").replace(",", "."))
    return round(valeur, 2)


def mois_de_cloture(jour):
    """Une clôture faite en début de mois concerne le mois précédent (ex. 04/10 → septembre)."""
    j = date.fromisoformat(jour) - timedelta(days=10)
    return f"{j.year}-{j.month:02d}"


# --- Construction des données ------------------------------------------------

STATUTS = {"Ouvert": "ouvert", "Fermé": "ferme", "Archivé": "archive", "Attente": "pause", "Pause": "pause"}
COULEURS = ["#A78BFA", "#F472B6", "#60A5FA", "#FBBF24", "#34D399", "#FB923C"]


def convertir(chemin_ods):
    feuilles = lire_feuilles(chemin_ods)
    home, impots = feuilles["Home"], feuilles["Impots"]
    rapport = []

    personnes = [
        {"id": "p1", "pseudo": PSEUDOS[0], "couleur": "#C084FC", "modifieLe": MAINTENANT},
        {"id": "p2", "pseudo": PSEUDOS[1], "couleur": "#6D4AFF", "modifieLe": MAINTENANT},
    ]

    # Revenus : déclaration 2025 (réelle) et simulation 2026 (estimée)
    revenus = {
        "2025": {
            "p1": {"brut": None, "netImposable": centimes(cellule(impots, "B5")), "impotSeul": centimes(cellule(impots, "D5"))},
            "p2": {"brut": None, "netImposable": centimes(cellule(impots, "B4")), "impotSeul": centimes(cellule(impots, "D4"))},
            "impotCouple": centimes(cellule(impots, "E7")),
            "estime": False,
            "modifieLe": MAINTENANT,
        },
        "2026": {
            "p1": {"brut": None, "netImposable": centimes(cellule(impots, "E22")), "impotSeul": centimes(cellule(impots, "G22"))},
            "p2": {"brut": None, "netImposable": centimes(cellule(impots, "E21")), "impotSeul": centimes(cellule(impots, "G21"))},
            "impotCouple": centimes(cellule(impots, "H24")),
            "estime": True,
            "modifieLe": MAINTENANT,
        },
    }

    reglages = {
        "methodeProrata": "net-mensuel",
        # Salaires nets mensuels de l'onglet Home (C9, D9) : point de départ de la première clôture
        "derniersSalaires": {"p1": centimes(cellule(home, "C9")), "p2": centimes(cellule(home, "D9"))},
        "prorataManuel": {"p1": 50, "p2": 50},
        "partPerso": {"p1": pourcentage(cellule(home, "C11")), "p2": pourcentage(cellule(home, "D11"))},
        "reevaluation": {"mode": "suggestion", "frequence": "mensuelle", "variationMax": 10},
        "surplus": "redistribuer",
        "seuilAlerte": 100,
        "modifieLe": MAINTENANT,
    }

    part_p1_veto = pourcentage(cellule(home, "C4"))
    exceptionnelles = [{
        "id": "x1", "nom": "Vétérinaire", "actif": True, "mode": "fixe",
        "parts": {"p1": part_p1_veto, "p2": 100 - part_p1_veto},
        "payeur": "p1", "modifieLe": MAINTENANT,
    }]

    # Enveloppes : tableau « Définition des Budgets »
    categories, enveloppes, par_nom = {}, [], {}
    for ligne in home[21:50]:
        ligne = ligne + [None] * 7
        cat, nom, part, limite, budget, _, etat = ligne[:7]
        if not nom:
            continue
        if cat not in categories:
            categories[cat] = {"id": f"c{len(categories) + 1}", "nom": cat,
                               "couleur": COULEURS[len(categories) % len(COULEURS)], "modifieLe": MAINTENANT}
        statut = next((v for k, v in STATUTS.items() if k in str(etat)), "pause")
        enveloppe = {
            "id": f"e{len(enveloppes) + 1}", "categorie": categories[cat]["id"], "nom": nom,
            "objectifInitial": centimes(budget), "echeance": mois_iso(limite),
            "pourcentage": pourcentage(part), "statut": statut,
            "plancher": 0, "verrouille": False, "recurrente": False, "modifieLe": MAINTENANT,
        }
        enveloppes.append(enveloppe)
        par_nom[nom] = enveloppe

    # Clôtures : feuille Data, une ligne par mois
    clotures, cloture_du_jour = [], {}
    for ligne in feuilles["Data"][1:]:
        if not ligne or not ligne[0]:
            continue
        jour = date_iso(ligne[0])
        veto, virement, reste_l, perso_l, commun_l, perso_k, commun_k = (centimes(v) for v in ligne[1:8])
        reste_k = perso_k + commun_k
        cloture = {
            "id": f"k{len(clotures) + 1}", "date": jour, "mois": mois_de_cloture(jour),
            "prorata": {"p1": round(reste_l * 100 / (reste_l + reste_k), 2),
                        "p2": round(reste_k * 100 / (reste_l + reste_k), 2)},
            "reste": {"p1": reste_l, "p2": reste_k},
            "perso": {"p1": perso_l, "p2": perso_k},
            "commun": {"p1": commun_l, "p2": commun_k},
            "exceptionnelles": [{"id": "x1", "montant": veto, "payeur": "p1",
                                 "remboursement": {"de": "p2", "a": "p1", "montant": virement}}] if veto else [],
            "annulee": False, "modifieLe": MAINTENANT,
        }
        if any(c["mois"] == cloture["mois"] for c in clotures):
            rapport.append(f"Deux clôtures pour {cloture['mois']} (le {jour}) : à vérifier.")
        clotures.append(cloture)
        cloture_du_jour.setdefault(jour, cloture["id"])

    # Mouvements : feuille Data_Details
    lignes = []
    for ligne in feuilles["Data_Details"][1:]:
        ligne = ligne + [None] * 6
        if not ligne[0] or not ligne[2]:
            continue
        nom = ligne[2]
        if nom not in par_nom:
            # Mouvements rattachés à un nom absent du tableau des budgets : on recrée l'enveloppe
            cat = ligne[1]
            if cat not in categories:
                categories[cat] = {"id": f"c{len(categories) + 1}", "nom": cat,
                                   "couleur": COULEURS[len(categories) % len(COULEURS)], "modifieLe": MAINTENANT}
            enveloppe = {
                "id": f"e{len(enveloppes) + 1}", "categorie": categories[cat]["id"], "nom": nom,
                "objectifInitial": 0, "echeance": None, "pourcentage": 0, "statut": "pause",
                "plancher": 0, "verrouille": False, "recurrente": False, "modifieLe": MAINTENANT,
            }
            enveloppes.append(enveloppe)
            par_nom[nom] = enveloppe
            rapport.append(f"« {nom} » n'existe pas dans le tableau des budgets : enveloppe recréée en pause.")
        lignes.append({"date": date_iso(ligne[0]), "enveloppe": par_nom[nom]["id"],
                       "exact": float(ligne[4]), "note": ligne[5] or ""})

    # Arrondi cumulé : la somme des centimes retombe exactement sur le solde arrondi du tableur
    cumul_exact, cumul_arrondi = defaultdict(float), defaultdict(int)
    for l in lignes:
        cumul_exact[l["enveloppe"]] += l["exact"]
        nouveau = round(cumul_exact[l["enveloppe"]] * 100)
        l["montant"] = nouveau - cumul_arrondi[l["enveloppe"]]
        cumul_arrondi[l["enveloppe"]] = nouveau

    # Une sortie et une entrée du même montant, le même jour = un transfert
    transferts = set()
    for i, a in enumerate(lignes):
        for j, b in enumerate(lignes):
            if i in transferts or j in transferts or i == j:
                continue
            if a["date"] == b["date"] and a["montant"] < 0 and a["montant"] == -b["montant"] and a["enveloppe"] != b["enveloppe"]:
                transferts.update((i, j))
                a["vers"] = b["enveloppe"]

    mouvements = []
    for i, l in enumerate(lignes):
        if i in transferts and "vers" not in l:
            continue
        if "vers" in l:
            genre = "transfert"
        elif l["montant"] < 0:
            genre = "depense"
        else:
            genre = "versement"
        mouvements.append({
            "id": f"m{len(mouvements) + 1}", "date": l["date"], "enveloppe": l["enveloppe"],
            "type": genre, "montant": abs(l["montant"]), "vers": l.get("vers"), "note": l["note"],
            "cloture": cloture_du_jour.get(l["date"]) if genre == "versement" else None,
            "annule": False, "modifieLe": MAINTENANT,
        })

    # L'objectif courant doit rester celui du tableur : on lui rajoute les dépenses déjà faites
    depenses = defaultdict(int)
    for m in mouvements:
        if m["type"] == "depense":
            depenses[m["enveloppe"]] += m["montant"]
    for e in enveloppes:
        e["objectifInitial"] += depenses[e["id"]]

    enveloppes.append({
        "id": "tampon", "categorie": None, "nom": "Tampon", "special": "tampon",
        "objectifInitial": 0, "echeance": None, "pourcentage": 0, "statut": "ouvert",
        "plancher": 0, "verrouille": True, "recurrente": False, "modifieLe": MAINTENANT,
    })

    donnees = {
        "version": 1, "personnes": personnes, "revenus": revenus, "reglages": reglages,
        "categories": list(categories.values()), "exceptionnelles": exceptionnelles,
        "enveloppes": enveloppes, "mouvements": mouvements, "clotures": clotures, "controles": [],
    }
    return donnees, rapport, feuilles


def controler(donnees, feuilles):
    """Compare le solde de chaque enveloppe : tableur (colonne « Somme actu ») contre application."""
    solde = defaultdict(int)
    for m in donnees["mouvements"]:
        signe = 1 if m["type"] == "versement" else -1
        solde[m["enveloppe"]] += signe * m["montant"]
        if m["type"] == "transfert":
            solde[m["vers"]] += m["montant"]

    tableur = {l[1]: l[5] for l in feuilles["Home"][21:50] if len(l) > 5 and l[1]}
    print(f"\n{'Enveloppe':24}{'Tableur':>12}{'Application':>14}")
    for e in donnees["enveloppes"]:
        avant = tableur.get(e["nom"])
        avant = f"{avant:.2f}" if isinstance(avant, float) else "absente"
        print(f"{e['nom']:24}{avant:>12}{solde[e['id']] / 100:>14.2f}")


if __name__ == "__main__":
    if len(sys.argv) not in (3, 5):
        sys.exit(__doc__)
    if len(sys.argv) == 5:
        PSEUDOS[:] = sys.argv[3:5]
    donnees, rapport, feuilles = convertir(sys.argv[1])
    # Pour le récapitulatif du guide : soldes du tableur, effacés une fois le guide terminé
    tableur = {l[1]: l[5] for l in feuilles["Home"][21:50] if len(l) > 5 and l[1]}
    donnees["_controleImport"] = {e["id"]: (centimes(tableur[e["nom"]]) if isinstance(tableur.get(e["nom"]), float) else None)
                                  for e in donnees["enveloppes"] if not e.get("special")}
    donnees["_rapportImport"] = rapport
    with open(sys.argv[2], "w", encoding="utf-8") as sortie:
        json.dump(donnees, sortie, ensure_ascii=False, indent=1)
    print(f"{len(donnees['enveloppes'])} enveloppes, {len(donnees['mouvements'])} mouvements, "
          f"{len(donnees['clotures'])} clôtures → {sys.argv[2]}")
    for ligne in rapport:
        print("•", ligne)
    controler(donnees, feuilles)
