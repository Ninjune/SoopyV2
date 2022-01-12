/// <reference types="../../../CTAutocomplete" />
/// <reference lib="es2015" />
import Feature from "../../featureClass/class";
import DragonWings from "./cosmetic/dragon/dragonWings"
import Toggle from "../settings/settingThings/toggle"
import { f } from "../../../mappings/mappings";
import FakeRequireToggle from "../settings/settingThings/FakeRequireToggle";

class Cosmetics extends Feature {
    constructor() {
        super()
    }

    onEnable(){
        this.initVariables()
        this.loadedCosmetics = []
        this.uuidToCosmetic = {}
        this.uuidToCosmeticDirect = {}

        this.cosmeticsData = {}
        
        this.hiddenEssentialCosmetics = []

        this.cosmeticsList = {
            "dragon_wings": DragonWings
        }

        this.playerHasACosmeticA = false

        this.firstPersonVisable = new Toggle("Cosmetics visable in first person", "", false, "cosmetics_first_person_visable", this)
        this.lessFirstPersonVisable = new Toggle("Make cosmetics less visable in first person mode", "", true, "cosmetics_first_person_less_visable", this).requires(this.firstPersonVisable)
        this.ownCosmeticAudio = new Toggle("Audio for own cosmetics", "", false, "cosmetics_own_audio", this)

        this.dragon_wings_enabled = new Toggle("Dragon Wings Toggle", "", true, "cosmetic_dragon_wings_toggle", this).requires(new FakeRequireToggle(false)).onchange(this, ()=>{
            global.soopyV2Server.updateCosmeticsData({
                cosmetic: "dragon_wings",
                type: this.dragon_wings_enabled.getValue() ? "enable" : "disable"
            })
        })

        this.loadCosmeticsData()

        this.worldLoad()

        this.registerEvent("tick", this.tick)
        this.registerEvent("renderWorld", this.renderWorld)
        this.registerEvent("playerJoined", this.playerJoined)
        this.registerEvent("playerLeft", this.playerLeft)
        this.registerEvent("worldLoad", this.worldLoad)
        this.registerStep(false, 2, this.step)
        this.registerStep(false, 60*10, ()=>{
            new Thread(()=>{this.loadCosmeticsData.call(this)}).start()
        })
        // this.registerEvent("renderEntity", this.renderEntity)
        this.loadedRenderEntity = false

        if(global.soopyV2Server.userCosmeticPermissions){
            this.updateUserCosmeticPermissionSettings()
        }
    }

    updateUserCosmeticPermissionSettings(){
        if(!this.enabled) return

        if(global.soopyV2Server.userCosmeticPermissions === "*" || global.soopyV2Server.userCosmeticPermissions.dragon_wings){
            this.dragon_wings_enabled.requiresO.set(true)
        }else{
            this.dragon_wings_enabled.requiresO.set(false)
        }
    }

    renderWorld(ticks){
        for(cosmetic of this.loadedCosmetics){
            cosmetic.onRenderEntity(ticks, false)
        }
    }

    renderEntity(entity, pos, ticks, event){
        if(ticks !== 1) return
        if(this.uuidToCosmeticDirect[entity.getUUID().toString().replace(/-/g,"")]){
            Object.values(this.uuidToCosmeticDirect[entity.getUUID().toString().replace(/-/g,"")]).forEach(cosmetic => {
                cosmetic.onRenderEntity(ticks, true)
            })
        }
    }

    loadCosmeticsData(){
        let data = JSON.parse(FileLib.getUrlContent("http://soopymc.my.to/api/soopyv2/cosmetics.json"))

        this.cosmeticsData = data
        this.playerHasACosmeticA = !!data[Player.getUUID().toString().replace(/-/g,"")]
        if(this.playerHasACosmeticA && !this.loadedRenderEntity){
            this.registerEvent("renderEntity", this.renderEntity)
            this.loadedRenderEntity = true
        }

        this.scanForNewCosmetics()
    }

    setUserCosmeticsInformation(uuid, cosmetics){
        if(!this.enabled) return
        uuid = uuid.replace(/-/g,"")

        this.loadedCosmetics = this.loadedCosmetics.filter(cosmetic=>{
            if(cosmetic.player.getUUID().toString().replace(/-/g,"") === uuid){
                return false
            }
            return true
        })
        Object.keys(this.uuidToCosmetic).forEach(cosmeticName=>{
            delete this.uuidToCosmetic[cosmeticName][uuid]
        })

        delete this.uuidToCosmeticDirect[uuid]

        if(!cosmetics){
            delete this.cosmeticsData[uuid]
            return
        }
        this.cosmeticsData[uuid] = cosmetics
        
        this.scanForNewCosmetics()
    }

    step(){
        this.scanForNewCosmetics()
    }
    scanForNewCosmetics(){
        this.loadCosmeticsForPlayer(Player)
        World.getAllPlayers().forEach(p=>{
            if(p.getUUID().toString().replace(/-/g,"") === Player.getUUID().toString().replace(/-/g,"")) return
            this.loadCosmeticsForPlayer(p)
        })
    }

    loadCosmeticsForPlayer(player){
        Object.keys(this.cosmeticsList).forEach(cosmeticName=>{
            if(!this.uuidToCosmetic[cosmeticName]) this.uuidToCosmetic[cosmeticName] = {}

            if(this.uuidToCosmetic[cosmeticName][player.getUUID().toString().replace(/-/g,"")]) return

            if(this.shouldPlayerHaveCosmetic(player, cosmeticName)){
                let cosmetic = new (this.cosmeticsList[cosmeticName])(player, this)
                this.loadedCosmetics.push(cosmetic)
                this.uuidToCosmetic[cosmeticName][player.getUUID().toString().replace(/-/g,"")] = cosmetic
                
                if(!this.uuidToCosmeticDirect[player.getUUID.toString()]) this.uuidToCosmeticDirect[player.getUUID().toString().replace(/-/g,"")] = {}
                this.uuidToCosmeticDirect[player.getUUID().toString().replace(/-/g,"")][cosmeticName] = cosmetic
            }
        })
    }

    worldLoad(){
        this.loadedCosmetics = []
        this.uuidToCosmetic = {}
        this.uuidToCosmeticDirect = {}

        this.loadCosmeticsForPlayer(Player)
        this.scanForNewCosmetics()
    }

    playerJoined(player){
        if(player.getUUID().toString().replace(/-/g,"") === Player.getUUID().toString().replace(/-/g,"")) return
        
        this.loadCosmeticsForPlayer(player)
    }

    playerLeft(playerName){
        this.loadedCosmetics= this.loadedCosmetics.filter(cosmetic=>{
            if(cosmetic.player.getUUID().toString().replace(/-/g,"") === Player.getUUID().toString().replace(/-/g,"")) return true
            if(cosmetic.player.getName() === playerName){
                this.uuidToCosmetic[cosmetic.id][cosmetic.player.getUUID().toString().replace(/-/g,"")] = undefined
            
                this.uuidToCosmeticDirect[cosmetic.player.getUUID().toString().replace(/-/g,"")] = undefined
                return false
            }
            return true
        })
    }

    shouldPlayerHaveCosmetic(player, cosmetic){
        if(!!this.cosmeticsData[player.getUUID().toString().replace(/-/g,"")]?.[cosmetic]){
            if(!this.getPlayerCosmeticSettings(player, cosmetic).enabled) return false
            return true
        }
        return false
    }
    getPlayerCosmeticSettings(player, cosmetic){
        return this.cosmeticsData[player.getUUID().toString().replace(/-/g,"")]?.[cosmetic]
    }

    filterUnloadedCosmetics(tick=false){
        this.loadedCosmetics = this.loadedCosmetics.filter(cosmetic => {
            if(tick) cosmetic.onTick()
            if(cosmetic.player.getUUID().toString().replace(/-/g,"") === Player.getUUID().toString().replace(/-/g,"")) return true
            if(cosmetic.player.getPlayer()[f.isDead]){  //filter out players that are no longer loaded
                this.uuidToCosmetic[cosmetic.id][cosmetic.player.getUUID().toString().replace(/-/g,"")] = undefined
                
                this.uuidToCosmeticDirect[cosmetic.player.getUUID().toString().replace(/-/g,"")] = undefined
                return false
            }
            return true
        })
    }

    tick(){
        this.restoreEssentialCosmetics()

        this.filterUnloadedCosmetics(true)
    }

    restoreEssentialCosmetics(){
        this.hiddenEssentialCosmetics.forEach(cosmetic=>{
            cosmetic.isHidden = false
        })
        this.hiddenEssentialCosmetics = []
    }

    initVariables(){
        this.loadedCosmetics = undefined
        this.uuidToCosmetic = undefined
        this.uuidToCosmeticDirect = undefined
        this.playerHasACosmeticA = undefined
        this.cosmeticsData = undefined
        this.hiddenEssentialCosmetics = undefined
        this.hiddenEssentialCosmetics = undefined
        this.cosmeticsList = undefined
    }

    onDisable(){
        this.restoreEssentialCosmetics()

        this.initVariables()
    }
}

let instance = new Cosmetics()

module.exports = {
    class: instance
}